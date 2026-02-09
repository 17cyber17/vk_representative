const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { fetchWallPosts } = require("./vk");
const {
  OWNER_ID,
  SYNC_LIMIT,
  UPLOADS_DIR,
  PUBLIC_UPLOADS_URL
} = require("./config");

function toIso(ts) {
  return new Date(ts * 1000).toISOString();
}

function pickLargestPhoto(attachment) {
  if (!attachment || attachment.type !== "photo" || !attachment.photo) {
    return null;
  }

  const sizes = attachment.photo.sizes || [];
  if (sizes.length === 0) return null;

  return sizes.reduce((largest, current) => {
    if (!largest) return current;
    const largestArea = (largest.width || 0) * (largest.height || 0);
    const currentArea = (current.width || 0) * (current.height || 0);
    return currentArea > largestArea ? current : largest;
  }, null);
}

function extractAttachments(post) {
  const directAttachments = post.attachments || [];
  if (directAttachments.length > 0) {
    return directAttachments;
  }

  const copyHistory = post.copy_history || [];
  return copyHistory.flatMap((historyPost) => historyPost.attachments || []);
}

function getRepostSourceName(post, groupsById) {
  const copyHistory = post.copy_history || [];
  if (copyHistory.length === 0) return null;

  const sourceOwnerId = copyHistory[0].owner_id;
  if (!sourceOwnerId || sourceOwnerId >= 0) return null;

  const group = groupsById.get(Math.abs(sourceOwnerId));
  return group ? group.name : null;
}

function getPostText(post) {
  if (post.text) return post.text;
  const copyHistory = post.copy_history || [];
  if (copyHistory.length === 0) return null;
  return copyHistory[0].text || null;
}

async function downloadImage(url, filename) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, filename);
  const response = await axios.get(url, { responseType: "stream" });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return filePath;
}

async function syncPosts(db, logger = console, options = {}) {
  if (!OWNER_ID) {
    throw new Error("OWNER_ID is required");
  }

  const parsedLimit = Number(options.limit);
  const parsedOffset = Number(options.offset);
  const syncLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : SYNC_LIMIT;
  let offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.floor(parsedOffset) : 0;
  const batchSize = 100;
  let fetched = 0;
  let created = 0;
  let updated = 0;

  while (fetched < syncLimit) {
    const count = Math.min(batchSize, syncLimit - fetched);
    const response = await fetchWallPosts({
      ownerId: OWNER_ID,
      count,
      offset
    });

    const groupsById = new Map((response.groups || []).map((group) => [group.id, group]));
    const items = response.items || [];
    if (items.length === 0) {
      break;
    }

    for (const post of items) {
      const postId = post.id;
      const dateIso = toIso(post.date);
      const text = getPostText(post);
      const repostSourceName = getRepostSourceName(post, groupsById);
      const nowIso = new Date().toISOString();

      const existing = await db.get(
        "SELECT post_id, text, date_iso, repost_source_name FROM posts WHERE post_id = ?",
        postId
      );

      if (!existing) {
        created += 1;
      } else if (
        existing.text !== text ||
        existing.date_iso !== dateIso ||
        existing.repost_source_name !== repostSourceName
      ) {
        updated += 1;
      }

      await db.run(
        `INSERT INTO posts (post_id, date_iso, text, repost_source_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(post_id) DO UPDATE SET
           date_iso = excluded.date_iso,
           text = excluded.text,
           repost_source_name = excluded.repost_source_name,
           updated_at = excluded.updated_at`,
        postId,
        dateIso,
        text,
        repostSourceName,
        nowIso,
        nowIso
      );

      await db.run("DELETE FROM post_images WHERE post_id = ?", postId);

      const attachments = extractAttachments(post);
      const photos = attachments
        .map(pickLargestPhoto)
        .filter(Boolean);

      for (const [index, photo] of photos.entries()) {
        const url = photo.url;
        if (!url) continue;
        const filename = `${postId}_${index}_${path.basename(url.split("?")[0])}`;
        await downloadImage(url, filename);

        await db.run(
          `INSERT INTO post_images (post_id, url, width, height)
           VALUES (?, ?, ?, ?)` ,
          postId,
          `${PUBLIC_UPLOADS_URL}/${filename}`,
          photo.width || null,
          photo.height || null
        );
      }

      fetched += 1;
      if (fetched >= syncLimit) {
        break;
      }
    }

    offset += items.length;
    if (items.length < count) {
      break;
    }
  }

  await db.run(
    `INSERT INTO sync_state (id, last_run_at, last_seen_post_date, last_seen_post_id)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_run_at = excluded.last_run_at,
       last_seen_post_date = excluded.last_seen_post_date,
       last_seen_post_id = excluded.last_seen_post_id`,
    new Date().toISOString(),
    await getLatestPostDate(db),
    await getLatestPostId(db)
  );

  logger.info(`Sync finished: created ${created}, updated ${updated}, total fetched ${fetched}.`);

  return { created, updated, fetched };
}

async function getLatestPostId(db) {
  const row = await db.get("SELECT post_id FROM posts ORDER BY date_iso DESC LIMIT 1");
  return row ? row.post_id : null;
}

async function getLatestPostDate(db) {
  const row = await db.get("SELECT date_iso FROM posts ORDER BY date_iso DESC LIMIT 1");
  return row ? row.date_iso : null;
}

module.exports = {
  syncPosts
};

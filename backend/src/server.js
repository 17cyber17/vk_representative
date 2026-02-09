require("dotenv").config();

const express = require("express");
const path = require("path");
const cron = require("node-cron");
const { initDb } = require("./db");
const { syncPosts } = require("./sync");
const {
  PORT,
  ADMIN_API_KEY,
  SYNC_CRON,
  UPLOADS_DIR
} = require("./config");

const app = express();
const publicDir = path.join(__dirname, "..", "public");

app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(publicDir));

let db;

app.get("/api/posts", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const offset = Number(req.query.offset || 0);

  try {
    const posts = await db.all(
      `SELECT post_id, date_iso, text, repost_source_name, created_at, updated_at
       FROM posts
       ORDER BY date_iso DESC
       LIMIT ? OFFSET ?`,
      limit,
      offset
    );

    const postIds = posts.map((post) => post.post_id);

    let images = [];
    let audios = [];
    if (postIds.length) {
      const placeholders = postIds.map(() => "?").join(",");
      images = await db.all(
        `SELECT id, post_id, url, width, height
         FROM post_images
         WHERE post_id IN (${placeholders})`,
        ...postIds
      );
      audios = await db.all(
        `SELECT id, post_id, url, title, artist
         FROM post_audio
         WHERE post_id IN (${placeholders})`,
        ...postIds
      );
    }

    const imagesByPost = images.reduce((acc, image) => {
      acc[image.post_id] = acc[image.post_id] || [];
      acc[image.post_id].push(image);
      return acc;
    }, {});

    const audiosByPost = audios.reduce((acc, audio) => {
      acc[audio.post_id] = acc[audio.post_id] || [];
      acc[audio.post_id].push(audio);
      return acc;
    }, {});

    const payload = posts.map((post) => ({
      ...post,
      images: imagesByPost[post.post_id] || [],
      audios: audiosByPost[post.post_id] || []
    }));

    res.json({ posts: payload, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/admin/sync", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const limit = req.body && req.body.limit !== undefined ? req.body.limit : undefined;
    const offset = req.body && req.body.offset !== undefined ? req.body.offset : undefined;
    const result = await syncPosts(db, console, { limit, offset });
    res.json({ status: "ok", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/admin/clear", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    await db.run("DELETE FROM post_images");
    await db.run("DELETE FROM posts");
    await db.run("DELETE FROM sync_state");
    res.json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  db = await initDb();

  cron.schedule(SYNC_CRON, async () => {
    try {
      await syncPosts(db, console);
    } catch (error) {
      console.error("Scheduled sync failed:", error.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();

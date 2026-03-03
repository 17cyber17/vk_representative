const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { DB_PATH } = require("./config");

async function initDb() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      post_id INTEGER PRIMARY KEY,
      date_iso TEXT NOT NULL,
      text TEXT,
      source_name TEXT,
      source_url TEXT,
      source_avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS post_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS post_audio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      artist TEXT,
      FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_run_at TEXT,
      last_seen_post_date TEXT,
      last_seen_post_id INTEGER
    );
  `);

  await ensurePostsColumns(db);
  await ensurePostAudioColumns(db);

  return db;
}

async function ensurePostsColumns(db) {
  const columns = await db.all("PRAGMA table_info(posts)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("source_name")) {
    await db.exec("ALTER TABLE posts ADD COLUMN source_name TEXT");
  }

  if (!columnNames.has("source_url")) {
    await db.exec("ALTER TABLE posts ADD COLUMN source_url TEXT");
  }

  if (!columnNames.has("source_avatar_url")) {
    await db.exec("ALTER TABLE posts ADD COLUMN source_avatar_url TEXT");
  }
}

async function ensurePostAudioColumns(db) {
  const columns = await db.all("PRAGMA table_info(post_audio)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("artist")) {
    await db.exec("ALTER TABLE post_audio ADD COLUMN artist TEXT");
  }
}

module.exports = {
  initDb
};

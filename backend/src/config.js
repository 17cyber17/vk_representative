const path = require("path");

const DATA_DIR = process.env.DATA_DIR || "/data";

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  VK_TOKEN: process.env.VK_TOKEN || "",
  VK_API_VERSION: process.env.VK_API_VERSION || "5.199",
  OWNER_ID: process.env.OWNER_ID || "",
  SYNC_LIMIT: Number(process.env.SYNC_LIMIT || 200),
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || "",
  SYNC_CRON: process.env.SYNC_CRON || "0 * * * *",
  DB_PATH: process.env.DB_PATH || path.join(DATA_DIR, "vk.db"),
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.join(DATA_DIR, "uploads"),
  PUBLIC_UPLOADS_URL: process.env.PUBLIC_UPLOADS_URL || "/uploads"
};

// config.js

import dotenv from "dotenv";
dotenv.config();

export const BOT_TOKEN = process.env.BOT_TOKEN;
export const DOMAIN = process.env.DOMAIN || "http://localhost:3000";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not defined in environment variables.");
}

// index.js

import { Connection, clusterApiUrl } from "@solana/web3.js";
import { initializeBot } from "./bot.js";
import { startWebServer } from "./webServer.js";
import { initializeRaydium } from "./swapService.js";

async function main() {
  // Connect to Solana mainnet
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

  // Start the Express server for Phantom flows
  startWebServer(connection);

  // Initialize Raydium
  await initializeRaydium(connection);

  // Initialize Telegram bot
  await initializeBot();
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});

// Handle errors
process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (reason) => console.error("Unhandled:", reason));

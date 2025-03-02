// bot.js

import { Telegraf } from "telegraf";
import { BOT_TOKEN, DOMAIN } from "./config.js";
import { createSession, setSwapDetails, getPublicKeyByUserId } from "./webServer.js";
import { getUserBalances } from "./utils.js";

// We'll export bot so webServer.js can use it
export const bot = new Telegraf(BOT_TOKEN);

// Helper to send messages from webServer
export async function botSendMessage(userId, text) {
  try {
    await bot.telegram.sendMessage(userId, text);
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

// Initialize & launch the bot
export async function initializeBot() {
  await bot.launch();
  console.log("Bot launched successfully.");
}

/**
 * Start command
 */
bot.start((ctx) => {
  ctx.reply("Welcome to InfiniteSwap! Connect Phantom or do a swap:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🟢 Connect Phantom", callback_data: "phantom_connect" },
          { text: "💰 View Balance", callback_data: "view_balance" },
        ],
        [{ text: "🔄 Swap", callback_data: "swap" }],
      ],
    },
  });
});

/**
 * Connect Phantom
 */
bot.action("phantom_connect", (ctx) => {
  const userId = ctx.from.id;
  const sessionId = createSession(userId);
  // Use DOMAIN from config
  const link = `${DOMAIN}/connect-phantom/${sessionId}`;

  ctx.editMessageText("Open this link to connect Phantom:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Connect Phantom (Web)", url: link }],
        [{ text: "🔙 Back", callback_data: "back_home" }],
      ],
    },
  });
});

/**
 * View Balance
 */
bot.action("view_balance", async (ctx) => {
  const userId = ctx.from.id;
  const publicKey = getPublicKeyByUserId(userId);

  if (!publicKey) {
    return ctx.editMessageText("No Phantom wallet connected. Please connect first.", {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "back_home" }]] },
    });
  }

  try {
    const balancesText = await getUserBalances(publicKey);
    ctx.editMessageText(`Your balances:\n${balancesText}`, {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "back_home" }]] },
    });
  } catch (err) {
    ctx.editMessageText(`Error fetching balances: ${err.message}`, {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "back_home" }]] },
    });
  }
});

/**
 * Swap
 */
bot.action("swap", (ctx) => {
  ctx.editMessageText("Select your swap direction:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "SOL → USDC", callback_data: "swap_SOL_USDC" },
          { text: "USDC → SOL", callback_data: "swap_USDC_SOL" },
        ],
        [{ text: "🔙 Back", callback_data: "back_home" }],
      ],
    },
  });
});

bot.action(["swap_SOL_USDC", "swap_USDC_SOL"], (ctx) => {
  const [_, fromToken, toToken] = ctx.match[0].split("_");
  ctx.editMessageText("Enter amount or select:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "MAX", callback_data: `amount_max_${fromToken}_${toToken}` }],
        [{ text: "50%", callback_data: `amount_50_${fromToken}_${toToken}` }],
        [{ text: "🔙 Back", callback_data: "back_home" }],
      ],
    },
  });
});

bot.action(/amount_(max|50)_(SOL|USDC)_(SOL|USDC)/, (ctx) => {
  const [_, percentage, fromToken, toToken] = ctx.match.input.split("_");
  const amount = percentage === "max" ? "All" : "50%";

  ctx.editMessageText(`Confirm swap: ${amount} ${fromToken} → ${toToken}?`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirm", callback_data: `confirm_swap_${amount}_${fromToken}_${toToken}` },
          { text: "❌ Cancel", callback_data: "back_home" },
        ],
      ],
    },
  });
});

/**
 * Confirm Swap -> Generate session, store swap details -> user signs on web
 */
bot.action(/confirm_swap_(All|50%)_(SOL|USDC)_(SOL|USDC)/, (ctx) => {
  const [_, amount, fromToken, toToken] = ctx.match.input.split("_");
  const userId = ctx.from.id;

  // Check if user is connected
  const publicKey = getPublicKeyByUserId(userId);
  if (!publicKey) {
    return ctx.editMessageText("No Phantom wallet connected. Please connect first.", {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "back_home" }]] },
    });
  }

  // Create a session for the swap
  const sessionId = createSession(userId);
  setSwapDetails(sessionId, { fromToken, toToken, amount });

  // Link to sign-swap
  const link = `${DOMAIN}/sign-swap/${sessionId}`;

  ctx.editMessageText("Click below to sign with Phantom:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Sign Transaction", url: link }],
        [{ text: "🔙 Back", callback_data: "back_home" }],
      ],
    },
  });
});

/**
 * Back home
 */
bot.action("back_home", (ctx) => {
  ctx.editMessageText("Welcome back!", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🟢 Connect Phantom", callback_data: "phantom_connect" },
          { text: "💰 View Balance", callback_data: "view_balance" },
        ],
        [{ text: "🔄 Swap", callback_data: "swap" }],
      ],
    },
  });
});

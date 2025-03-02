// swapService.js

import {
  Connection,
  PublicKey
} from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { getTokenMintAddress } from "./utils.js";

let raydium;
let cachedConnection;

/**
 * Initialize Raydium once
 */
export async function initializeRaydium(connection) {
  if (!raydium) {
    cachedConnection = connection;
    raydium = await Raydium.load({ connection });
    console.log("Raydium SDK initialized.");
  }
}

/**
 * Convert user-friendly token symbol to a PublicKey (SOL or token mint)
 */
async function resolveMintAddress(tokenSymbol) {
  if (tokenSymbol === "SOL") {
    return PublicKey.default;
  }
  const mint = await getTokenMintAddress(tokenSymbol);
  if (!mint) throw new Error(`Invalid token symbol: ${tokenSymbol}`);
  return new PublicKey(mint);
}

/**
 * Convert the user’s “amount” string to lamports
 */
function convertAmountToLamports(amount) {
  if (amount === "All") {
    // Example: assume user has 2 SOL
    return 2 * 1_000_000_000;
  }
  // e.g. "50%" => 1 SOL
  const pct = parseInt(amount.replace("%", ""));
  return (2 * 1_000_000_000 * pct) / 100;
}

/**
 * Build an unsigned transaction for the swap
 */
export async function getOrCreateUnsignedSwapTx({
  connection,
  userPublicKey,
  fromToken,
  toToken,
  amount,
}) {
  if (!raydium) {
    throw new Error("Raydium not initialized.");
  }
  const fromMint = await resolveMintAddress(fromToken);
  const toMint = await resolveMintAddress(toToken);
  const lamports = convertAmountToLamports(amount);

  const { routes } = await raydium.swap.getRoutes({
    inputMint: fromMint,
    outputMint: toMint,
    amountIn: lamports,
  });
  if (!routes || routes.length === 0) {
    throw new Error(`No routes found for ${fromToken} -> ${toToken}`);
  }
  const bestRoute = routes[0];

  const { transaction } = await raydium.swap.createSwapTransaction({
    route: bestRoute,
    userPublicKey: new PublicKey(userPublicKey),
  });

  return transaction;
}

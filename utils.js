// utils.js

import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import axios from "axios";

// For balance queries
const balanceConnection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

/**
 * Raydium token list for symbol resolution
 */
export async function getTokenMintAddress(symbol) {
  const response = await axios.get("https://api.raydium.io/v2/sdk/token/raydium.mainnet.json");
  const tokens = response.data.tokens;
  const token = Object.values(tokens).find((t) => t.symbol === symbol);
  return token ? token.mint : null;
}

/**
 * Fetch user balances
 */
export async function getUserBalances(publicKeyStr) {
  const userPk = new PublicKey(publicKeyStr);
  const solBalanceLamports = await balanceConnection.getBalance(userPk);
  const solBalance = solBalanceLamports / 1_000_000_000;

  const tokenAccounts = await balanceConnection.getParsedTokenAccountsByOwner(userPk, {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });

  let tokensText = "";
  for (const { account } of tokenAccounts.value) {
    const parsed = account.data.parsed.info;
    const mint = parsed.mint;
    const amount = parsed.tokenAmount.uiAmount;
    if (amount > 0) {
      tokensText += `Mint: ${mint}, Balance: ${amount}\n`;
    }
  }

  let result = `SOL: ${solBalance.toFixed(4)}\n`;
  if (tokensText) {
    result += tokensText;
  } else {
    result += "No SPL tokens found.\n";
  }
  return result;
}

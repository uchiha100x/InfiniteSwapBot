// webServer.js

import express from "express";
import { v4 as uuidv4 } from "uuid";
import bodyParser from "body-parser";
import { Connection, sendAndConfirmRawTransaction } from "@solana/web3.js";
import { botSendMessage } from "./bot.js";
import { getOrCreateUnsignedSwapTx } from "./swapService.js";

/**
 * sessionId -> { userId, publicKey, swapDetails }
 */
const sessions = new Map();
const app = express();
const port = 3000;

// Parse JSON bodies
app.use(bodyParser.json());

export function createSession(userId) {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    userId,
    publicKey: null,
    swapDetails: null,
  });
  return sessionId;
}
export function getPublicKeyByUserId(userId) {
  for (const [sessionId, data] of sessions) {
    if (data.userId === userId && data.publicKey) {
      return data.publicKey;
    }
  }
  return null;
}
function setPublicKey(sessionId, publicKey) {
  const sessionData = sessions.get(sessionId);
  if (!sessionData) return;
  sessionData.publicKey = publicKey;
  sessions.set(sessionId, sessionData);
}
export function setSwapDetails(sessionId, swapDetails) {
  const sessionData = sessions.get(sessionId);
  if (!sessionData) return;
  sessionData.swapDetails = swapDetails;
  sessions.set(sessionId, sessionData);
}

export function startWebServer(connection) {
  // 1) Connect Phantom
  app.get("/connect-phantom/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    if (!sessions.has(sessionId)) {
      return res.status(400).send("Invalid session ID");
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Connect Phantom</title>
</head>
<body>
  <h1>Connect Phantom Wallet</h1>
  <button id="connectBtn">Connect</button>
  <script>
    const sessionId = "${sessionId}";
    document.getElementById("connectBtn").onclick = async () => {
      if (!window.solana) {
        alert("Phantom not installed!");
        return;
      }
      try {
        const resp = await window.solana.connect();
        const publicKey = resp.publicKey.toString();
        fetch(\`/phantom-callback?sessionId=\${sessionId}&publicKey=\${publicKey}\`)
          .then(() => alert("Public key saved. You can return to Telegram."))
          .catch(() => alert("Error saving public key."));
      } catch (err) {
        alert("User rejected connection.");
      }
    };
  </script>
</body>
</html>
`;
    res.send(html);
  });

  // 2) Phantom callback
  app.get("/phantom-callback", (req, res) => {
    const { sessionId, publicKey } = req.query;
    if (!sessions.has(sessionId)) {
      return res.status(400).send("Invalid session ID");
    }
    setPublicKey(sessionId, publicKey);
    res.send("Public key saved. You can return to Telegram now.");
  });

  // 3) Sign Swap
  app.get("/sign-swap/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    if (!sessions.has(sessionId)) {
      return res.status(400).send("Invalid session ID");
    }
    const sessionData = sessions.get(sessionId);
    if (!sessionData.publicKey) {
      return res.status(400).send("You must connect Phantom first.");
    }
    if (!sessionData.swapDetails) {
      return res.status(400).send("No swap details found.");
    }

    const { fromToken, toToken, amount } = sessionData.swapDetails;
    const unsignedTx = await getOrCreateUnsignedSwapTx({
      connection,
      userPublicKey: sessionData.publicKey,
      fromToken,
      toToken,
      amount,
    });

    const txBase64 = unsignedTx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Sign Swap</title>
</head>
<body>
  <h1>Sign Your Swap Transaction</h1>
  <button id="signBtn">Sign & Send</button>
  <script>
    const sessionId = "${sessionId}";
    const txBase64 = "${txBase64}";

    document.getElementById("signBtn").onclick = async () => {
      if (!window.solana) {
        alert("Phantom not found!");
        return;
      }
      try {
        const txBytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
        const signedTx = await window.solana.signTransaction({ message: txBytes });

        fetch("/swap-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            signedTx: signedTx.signature
          })
        })
        .then(() => alert("Transaction broadcast! Check Telegram."))
        .catch(err => alert("Error broadcasting: " + err));
      } catch (err) {
        alert("User rejected transaction: " + err);
      }
    };
  </script>
</body>
</html>
`;
    res.send(html);
  });

  // 4) Swap callback
  app.post("/swap-callback", async (req, res) => {
    const { sessionId, signedTx } = req.body;
    if (!sessions.has(sessionId)) {
      return res.status(400).send("Invalid session ID");
    }
    const sessionData = sessions.get(sessionId);
    const { userId } = sessionData;

    try {
      const txBuffer = Buffer.from(signedTx, "base64");
      const signature = await sendAndConfirmRawTransaction(connection, txBuffer);
      await botSendMessage(userId, `✅ Swap Successful! Transaction: ${signature}`);
      res.json({ success: true, signature });
    } catch (error) {
      await botSendMessage(userId, `❌ Swap Failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, () => {
    console.log(`Advanced Phantom server running at port ${port}`);
  });
}

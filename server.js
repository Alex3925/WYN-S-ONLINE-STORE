const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname)));

app.post("/api/order", async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
      return res.status(503).json({
        ok: false,
        error: "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the server."
      });
    }

    const { orderId, total, items, ref, note, telegramUsername, deviceName, buildNumber } = req.body || {};

    if (!orderId || typeof total !== "number" || !Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: "Invalid order payload." });
    }

    if (!telegramUsername || !deviceName) {
      return res.status(400).json({ ok: false, error: "Telegram username and device name are required." });
    }

    if (items.length > 50) {
      return res.status(400).json({ ok: false, error: "Too many items." });
    }

    const lines = items
      .map((i) => `• ${String(i.name || i.id).slice(0, 80)} × ${Number(i.qty) || 1}`)
      .join("\n");

    const text = [
      "🛒 New order — FLUX ROOT SERVICES",
      "",
      `Order ID: ${String(orderId).slice(0, 40)}`,
      `Total: ₱${Number(total).toLocaleString("en-PH")}`,
      `Telegram: @${String(telegramUsername).replace(/^@/, "").slice(0, 50)}`,
      `Device: ${String(deviceName).slice(0, 80)}`,
      buildNumber ? `Build: ${String(buildNumber).slice(0, 80)}` : null,
      ref ? `Ref: ${String(ref).slice(0, 120)}` : null,
      note ? `Note: ${String(note).slice(0, 300)}` : null,
      "",
      "Items:",
      lines || "—",
      "",
      `Received ${new Date().toISOString()}`
    ]
      .filter((x) => x !== null)
      .join("\n");

    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true
      })
    });

    const tgData = await tgRes.json().catch(() => ({}));

    if (!tgRes.ok || !tgData.ok) {
      console.error("Telegram API error:", tgData);
      return res.status(502).json({
        ok: false,
        error: "Failed to send Telegram notification.",
        detail: tgData.description || null
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Order notify error:", err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`FLUX ROOT SERVICES on port ${PORT}`);
  console.log(`Telegram configured: ${Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)}`);
});

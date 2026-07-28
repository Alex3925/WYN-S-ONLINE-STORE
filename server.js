const express = require("express");
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "fluxadmin";
const DATABASE_URL = process.env.DATABASE_URL || "";

app.use(cors());
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname)));

let pool = null;
let dbReady = false;

async function initDb() {
  if (!DATABASE_URL) {
    console.warn("⚠ DATABASE_URL not set — orders will NOT persist to Neon.");
    return;
  }
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      total INTEGER NOT NULL,
      items JSONB NOT NULL,
      telegram_username TEXT NOT NULL,
      device_name TEXT NOT NULL,
      build_number TEXT,
      payment_ref TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_telegram ON orders (telegram_username);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
  `);
  dbReady = true;
  console.log("✓ Neon database connected");
}

function requireAdmin(req, res) {
  const key = req.headers["x-admin-secret"] || req.query.secret || (req.body && req.body.secret);
  if (!key || key !== ADMIN_SECRET) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

app.post("/api/order", async (req, res) => {
  try {
    const {
      orderId,
      total,
      items,
      ref,
      note,
      telegramUsername,
      deviceName,
      buildNumber
    } = req.body || {};

    if (!orderId || typeof total !== "number" || !Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: "Invalid order payload." });
    }
    if (!telegramUsername || !deviceName) {
      return res.status(400).json({
        ok: false,
        error: "Telegram username and device name are required."
      });
    }
    if (items.length > 50) {
      return res.status(400).json({ ok: false, error: "Too many items." });
    }

    const tgUser = String(telegramUsername).replace(/^@/, "").slice(0, 50);
    const device = String(deviceName).slice(0, 80);
    const build = buildNumber ? String(buildNumber).slice(0, 80) : null;
    const paymentRef = ref ? String(ref).slice(0, 120) : null;
    const orderNote = note ? String(note).slice(0, 300) : null;

    if (dbReady && pool) {
      await pool.query(
        `INSERT INTO orders
          (id, total, items, telegram_username, device_name, build_number, payment_ref, note, status)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, 'pending')
         ON CONFLICT (id) DO NOTHING`,
        [String(orderId).slice(0, 40), Math.round(total), JSON.stringify(items), tgUser, device, build, paymentRef, orderNote]
      );
    }

    let notifyOk = false;
    let notifyDetail = null;
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const lines = items
        .map((i) => `• ${String(i.name || i.id).slice(0, 80)} × ${Number(i.qty) || 1}`)
        .join("\n");
      const text = [
        "🛒 New order — FLUX ROOT SERVICES",
        "",
        `Order ID: ${String(orderId).slice(0, 40)}`,
        `Total: ₱${Number(total).toLocaleString("en-PH")}`,
        `Telegram: @${tgUser}`,
        `Device: ${device}`,
        build ? `Build: ${build}` : null,
        paymentRef ? `Ref: ${paymentRef}` : null,
        orderNote ? `Note: ${orderNote}` : null,
        "",
        "Items:",
        lines || "—",
        "",
        `Received ${new Date().toISOString()}`
      ]
        .filter((x) => x !== null)
        .join("\n");

      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text,
              disable_web_page_preview: true
            })
          }
        );
        const tgData = await tgRes.json().catch(() => ({}));
        notifyOk = tgRes.ok && tgData.ok;
        if (!notifyOk) notifyDetail = tgData.description || "Telegram failed";
      } catch (e) {
        notifyDetail = e.message;
      }
    } else {
      notifyDetail = "Telegram not configured";
    }

    return res.json({
      ok: true,
      saved: dbReady,
      notified: notifyOk,
      detail: notifyDetail
    });
  } catch (err) {
    console.error("Order error:", err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    if (!dbReady || !pool) {
      return res.status(503).json({ ok: false, error: "Database not configured." });
    }
    const { telegram, ids } = req.query;
    let result;
    if (telegram) {
      const user = String(telegram).replace(/^@/, "").slice(0, 50);
      result = await pool.query(
        `SELECT id, created_at, total, items, telegram_username, device_name,
                build_number, payment_ref, note, status
         FROM orders WHERE telegram_username = $1
         ORDER BY created_at DESC LIMIT 50`,
        [user]
      );
    } else if (ids) {
      const idList = String(ids)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50);
      if (idList.length === 0) {
        return res.json({ ok: true, orders: [] });
      }
      result = await pool.query(
        `SELECT id, created_at, total, items, telegram_username, device_name,
                build_number, payment_ref, note, status
         FROM orders WHERE id = ANY($1::text[])
         ORDER BY created_at DESC`,
        [idList]
      );
    } else {
      return res.status(400).json({ ok: false, error: "Provide telegram or ids." });
    }

    const orders = result.rows.map(rowToOrder);
    return res.json({ ok: true, orders });
  } catch (err) {
    console.error("Get orders error:", err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("/api/admin/orders", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) {
      return res.status(503).json({ ok: false, error: "Database not configured." });
    }
    const status = req.query.status;
    let result;
    if (status === "pending" || status === "completed") {
      result = await pool.query(
        `SELECT id, created_at, total, items, telegram_username, device_name,
                build_number, payment_ref, note, status
         FROM orders WHERE status = $1
         ORDER BY created_at DESC LIMIT 100`,
        [status]
      );
    } else {
      result = await pool.query(
        `SELECT id, created_at, total, items, telegram_username, device_name,
                build_number, payment_ref, note, status
         FROM orders
         ORDER BY created_at DESC LIMIT 100`
      );
    }
    return res.json({ ok: true, orders: result.rows.map(rowToOrder) });
  } catch (err) {
    console.error("Admin list error:", err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.patch("/api/admin/orders/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) {
      return res.status(503).json({ ok: false, error: "Database not configured." });
    }
    const id = String(req.params.id).slice(0, 40);
    const status = req.body && req.body.status;
    if (status !== "pending" && status !== "completed") {
      return res.status(400).json({ ok: false, error: "status must be pending or completed" });
    }
    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status`,
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }
    return res.json({ ok: true, id: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    console.error("Admin update error:", err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    db: dbReady,
    telegram: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

function rowToOrder(r) {
  return {
    id: r.id,
    date: r.created_at,
    total: r.total,
    items: r.items,
    telegramUsername: r.telegram_username,
    deviceName: r.device_name,
    buildNumber: r.build_number,
    ref: r.payment_ref,
    note: r.note,
    status: r.status
  };
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FLUX ROOT SERVICES on port ${PORT}`);
      console.log(`DB: ${dbReady ? "ready" : "off"} | Telegram: ${Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)}`);
    });
  })
  .catch((err) => {
    console.error("Failed to init DB:", err);
    app.listen(PORT, () => {
      console.log(`FLUX ROOT SERVICES on port ${PORT} (DB failed to start)`);
    });
  });

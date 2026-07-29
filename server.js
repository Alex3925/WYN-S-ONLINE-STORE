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

const DEFAULT_PRODUCTS = [
  {
    id: "root-service",
    name: "ROOT SERVICE",
    price: 300,
    category: "Rooting",
    description: "Full root access for your device. Instant delivery via Telegram after payment confirmation.",
    tags: ["root", "magisk", "android"],
    requires_build: true,
    active: true,
    sort_order: 1
  },
  {
    id: "unlock-bootloader",
    name: "UNLOCK BOOTLOADER",
    price: 150,
    category: "Unlock",
    description: "Official / unofficial bootloader unlock service. Device-specific instructions included.",
    tags: ["unlock", "bootloader", "oem"],
    requires_build: false,
    active: true,
    sort_order: 2
  },
  {
    id: "transsion-firmware",
    name: "TRANSSION FIRMWARE",
    price: 150,
    category: "Firmware",
    description: "Stock / custom firmware for Transsion devices (Infinix, Tecno, itel). Flash-ready files.",
    tags: ["firmware", "transsion", "infinix", "tecno", "itel"],
    requires_build: true,
    active: true,
    sort_order: 3
  }
];

function parsePrice(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const n = parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

async function initDb() {
  if (!DATABASE_URL) {
    console.warn("DATABASE_URL not set — DB features disabled.");
    return;
  }
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5
  });

  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
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
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_telegram ON orders (telegram_username)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    requires_build BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_active ON products (active)`);

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM products`);
  if (rows[0].n === 0) {
    for (const p of DEFAULT_PRODUCTS) {
      await pool.query(
        `INSERT INTO products (id, name, price, category, description, tags, requires_build, active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.price, p.category, p.description, JSON.stringify(p.tags), p.requires_build, p.active, p.sort_order]
      );
    }
    console.log("Seeded default products");
  }

  dbReady = true;
  console.log("Neon database connected");
}

function requireAdmin(req, res) {
  const key = req.headers["x-admin-secret"] || req.query.secret || (req.body && req.body.secret);
  if (!key || key !== ADMIN_SECRET) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "service";
}

function rowToProduct(r) {
  return {
    id: r.id,
    name: r.name,
    price: parsePrice(r.price),
    category: r.category,
    description: r.description || "",
    tags: Array.isArray(r.tags) ? r.tags : [],
    requiresBuild: Boolean(r.requires_build),
    active: r.active !== false && r.active !== "f" && r.active !== 0,
    sortOrder: parsePrice(r.sort_order)
  };
}

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

app.get("/api/products", async (req, res) => {
  try {
    if (!dbReady || !pool) {
      return res.json({
        ok: true,
        products: DEFAULT_PRODUCTS.map((p) => ({
          id: p.id, name: p.name, price: p.price, category: p.category,
          description: p.description, tags: p.tags, requiresBuild: p.requires_build
        })),
        source: "fallback"
      });
    }
    const all = req.query.all === "1";
    const result = await pool.query(
      all
        ? `SELECT * FROM products ORDER BY sort_order ASC, name ASC`
        : `SELECT * FROM products WHERE active = true ORDER BY sort_order ASC, name ASC`
    );
    return res.json({ ok: true, products: result.rows.map(rowToProduct), source: "db" });
  } catch (err) {
    console.error("Products list error:", err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("/api/admin/products", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) return res.status(503).json({ ok: false, error: "Database not configured." });
    const result = await pool.query(`SELECT * FROM products ORDER BY sort_order ASC, name ASC`);
    return res.json({ ok: true, products: result.rows.map(rowToProduct) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.post("/api/admin/products", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) return res.status(503).json({ ok: false, error: "Database not configured." });
    const b = req.body || {};
    const name = String(b.name || "").trim().slice(0, 80);
    const category = String(b.category || "").trim().slice(0, 40);
    const price = parsePrice(b.price);
    const description = String(b.description || "").trim().slice(0, 500);
    const requiresBuild = Boolean(b.requiresBuild);
    const active = b.active !== false;
    const sortOrder = parsePrice(b.sortOrder);
    const tags = Array.isArray(b.tags) ? b.tags.map((t) => String(t).slice(0, 30)).slice(0, 20) : [];
    if (!name || !category || !Number.isFinite(price) || price < 1) {
      return res.status(400).json({ ok: false, error: "name, category, and price (at least 1 PHP) are required." });
    }
    let id = b.id ? String(b.id).slice(0, 48) : slugify(name);
    const existing = await pool.query(`SELECT id FROM products WHERE id = $1`, [id]);
    if (existing.rowCount > 0) id = id + "-" + Date.now().toString(36).slice(-4);
    await pool.query(
      `INSERT INTO products (id, name, price, category, description, tags, requires_build, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
      [id, name, price, category, description, JSON.stringify(tags), requiresBuild, active, sortOrder]
    );
    const row = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
    return res.json({ ok: true, product: rowToProduct(row.rows[0]) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.put("/api/admin/products/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) return res.status(503).json({ ok: false, error: "Database not configured." });
    const id = String(req.params.id).slice(0, 48);
    const b = req.body || {};
    const name = String(b.name || "").trim().slice(0, 80);
    const category = String(b.category || "").trim().slice(0, 40);
    const price = parsePrice(b.price);
    const description = String(b.description || "").trim().slice(0, 500);
    const requiresBuild = Boolean(b.requiresBuild);
    const active = b.active !== false;
    const sortOrder = parsePrice(b.sortOrder);
    const tags = Array.isArray(b.tags) ? b.tags.map((t) => String(t).slice(0, 30)).slice(0, 20) : [];
    if (!name || !category || !Number.isFinite(price) || price < 1) {
      return res.status(400).json({ ok: false, error: "name, category, and price (at least 1 PHP) are required." });
    }
    const result = await pool.query(
      `UPDATE products SET name=$1, price=$2, category=$3, description=$4, tags=$5::jsonb,
       requires_build=$6, active=$7, sort_order=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [name, price, category, description, JSON.stringify(tags), requiresBuild, active, sortOrder, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "Product not found" });
    return res.json({ ok: true, product: rowToProduct(result.rows[0]) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.delete("/api/admin/products/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) return res.status(503).json({ ok: false, error: "Database not configured." });
    const id = String(req.params.id).slice(0, 48);
    const result = await pool.query(`DELETE FROM products WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "Product not found" });
    return res.json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.post("/api/order", async (req, res) => {
  try {
    const { orderId, total, items, ref, note, telegramUsername, deviceName, buildNumber } = req.body || {};
    if (!orderId || typeof total !== "number" || !Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: "Invalid order payload." });
    }
    if (!telegramUsername || !deviceName) {
      return res.status(400).json({ ok: false, error: "Telegram username and device name are required." });
    }
    if (items.length > 50) return res.status(400).json({ ok: false, error: "Too many items." });

    const tgUser = String(telegramUsername).replace(/^@/, "").slice(0, 50);
    const device = String(deviceName).slice(0, 80);
    const build = buildNumber ? String(buildNumber).slice(0, 80) : null;
    const paymentRef = ref ? String(ref).slice(0, 120) : null;
    const orderNote = note ? String(note).slice(0, 300) : null;

    if (dbReady && pool) {
      await pool.query(
        `INSERT INTO orders (id, total, items, telegram_username, device_name, build_number, payment_ref, note, status)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, 'pending') ON CONFLICT (id) DO NOTHING`,
        [String(orderId).slice(0, 40), Math.round(total), JSON.stringify(items), tgUser, device, build, paymentRef, orderNote]
      );
    }

    let notifyOk = false;
    let notifyDetail = null;
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const lines = items.map((i) => `• ${String(i.name || i.id).slice(0, 80)} x ${Number(i.qty) || 1}`).join("\n");
      const text = [
        "New order — FLUX ROOT SERVICES", "",
        `Order ID: ${String(orderId).slice(0, 40)}`,
        `Total: PHP ${Number(total).toLocaleString("en-PH")}`,
        `Telegram: @${tgUser}`, `Device: ${device}`,
        build ? `Build: ${build}` : null,
        paymentRef ? `Ref: ${paymentRef}` : null,
        orderNote ? `Note: ${orderNote}` : null,
        "", "Items:", lines || "-", "", `Received ${new Date().toISOString()}`
      ].filter((x) => x !== null).join("\n");
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
        });
        const tgData = await tgRes.json().catch(() => ({}));
        notifyOk = tgRes.ok && tgData.ok;
        if (!notifyOk) notifyDetail = tgData.description || "Telegram failed";
      } catch (e) {
        notifyDetail = e.message;
      }
    } else {
      notifyDetail = "Telegram not configured";
    }

    return res.json({ ok: true, saved: dbReady, notified: notifyOk, detail: notifyDetail });
  } catch (err) {
    console.error("Order error:", err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    if (!dbReady || !pool) return res.status(503).json({ ok: false, error: "Database not configured." });
    const { telegram, ids } = req.query;
    let result;
    if (telegram) {
      const user = String(telegram).replace(/^@/, "").slice(0, 50);
      result = await pool.query(`SELECT * FROM orders WHERE telegram_username = $1 ORDER BY created_at DESC LIMIT 50`, [user]);
    } else if (ids) {
      const idList = String(ids).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
      if (idList.length === 0) return res.json({ ok: true, orders: [] });
      result = await pool.query(`SELECT * FROM orders WHERE id = ANY($1::text[]) ORDER BY created_at DESC`, [idList]);
    } else {
      return res.status(400).json({ ok: false, error: "Provide telegram or ids." });
    }
    return res.json({ ok: true, orders: result.rows.map(rowToOrder) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("/api/admin/orders", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) return res.status(503).json({ ok: false, error: "Database not configured." });
    const status = req.query.status;
    let result;
    if (status === "pending" || status === "completed") {
      result = await pool.query(`SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT 100`, [status]);
    } else {
      result = await pool.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`);
    }
    return res.json({ ok: true, orders: result.rows.map(rowToOrder) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.patch("/api/admin/orders/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!dbReady || !pool) return res.status(503).json({ ok: false, error: "Database not configured." });
    const id = String(req.params.id).slice(0, 40);
    const status = req.body && req.body.status;
    if (status !== "pending" && status !== "completed") {
      return res.status(400).json({ ok: false, error: "status must be pending or completed" });
    }
    const result = await pool.query(`UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status`, [status, id]);
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "Order not found" });
    return res.json({ ok: true, id: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: dbReady, telegram: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) });
});

// Do not return index.html for missing .js / .css / images
app.get("*", (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).type("text/plain").send("Not found");
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FLUX ROOT SERVICES on port ${PORT}`);
      console.log(`DB: ${dbReady ? "ready" : "off"} | Telegram: ${Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)}`);
    });
  })
  .catch((err) => {
    console.error("Failed to init DB:", err);
    app.listen(PORT, () => console.log(`FLUX ROOT SERVICES on port ${PORT} (DB failed)`));
  });

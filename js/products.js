// Loaded from Neon via /api/products — fallback defaults if API is down
let PRODUCTS = [
  {
    id: "root-service",
    name: "ROOT SERVICE",
    price: 300,
    category: "Rooting",
    description: "Full root access for your device. Instant delivery via Telegram after payment confirmation.",
    tags: ["root", "magisk", "android"],
    requiresBuild: true
  },
  {
    id: "unlock-bootloader",
    name: "UNLOCK BOOTLOADER",
    price: 150,
    category: "Unlock",
    description: "Official / unofficial bootloader unlock service. Device-specific instructions included.",
    tags: ["unlock", "bootloader", "oem"],
    requiresBuild: false
  },
  {
    id: "transsion-firmware",
    name: "TRANSSION FIRMWARE",
    price: 150,
    category: "Firmware",
    description: "Stock / custom firmware for Transsion devices (Infinix, Tecno, itel). Flash-ready files.",
    tags: ["firmware", "transsion", "infinix", "tecno", "itel"],
    requiresBuild: true
  }
];

let CATEGORIES = ["All", "Rooting", "Unlock", "Firmware"];

function rebuildCategories() {
  const set = new Set(PRODUCTS.map((p) => p.category).filter(Boolean));
  CATEGORIES = ["All", ...Array.from(set).sort()];
}

async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && Array.isArray(data.products) && data.products.length) {
      PRODUCTS = data.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: parseInt(String(p.price == null ? "0" : p.price).replace(/[^0-9]/g, ""), 10) || 0,
        category: p.category,
        description: p.description || "",
        tags: Array.isArray(p.tags) ? p.tags : [],
        requiresBuild: Boolean(p.requiresBuild)
      }));
      rebuildCategories();
      return true;
    }
  } catch (e) {
    console.warn("Products API unavailable, using defaults", e);
  }
  rebuildCategories();
  return false;
}

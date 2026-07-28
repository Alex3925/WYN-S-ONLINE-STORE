// Product catalog - easy to extend later
const PRODUCTS = [
  {
    id: "root-service",
    name: "ROOT SERVICE",
    price: 300,
    category: "Rooting",
    description: "Full root access for your device. Instant delivery via Telegram after payment confirmation.",
    tags: ["root", "magisk", "android"]
  },
  {
    id: "unlock-bootloader",
    name: "UNLOCK BOOTLOADER",
    price: 150,
    category: "Unlock",
    description: "Official / unofficial bootloader unlock service. Device-specific instructions included.",
    tags: ["unlock", "bootloader", "oem"]
  },
  {
    id: "transsion-firmware",
    name: "TRANSSION FIRMWARE",
    price: 150,
    category: "Firmware",
    description: "Stock / custom firmware for Transsion devices (Infinix, Tecno, itel). Flash-ready files.",
    tags: ["firmware", "transsion", "infinix", "tecno", "itel"]
  }
];

const CATEGORIES = ["All", "Rooting", "Unlock", "Firmware"];

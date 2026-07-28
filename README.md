# WYN'S SARI SARI STORE

Simple digital services storefront (dark theme) — Root, Unlock Bootloader, Firmware, etc.

**Pay via Maya QR PH · Delivery via Telegram**

## Features

- Product catalog with categories & search
- Cart (localStorage)
- Checkout with Maya QR + order creation
- Order history (saved on the device)
- Mobile-friendly dark UI
- Ready for Render (static site)

## Quick start (local)

Just open `index.html` in a browser, or run a static server:

```bash
npx serve .
# or
python -m http.server 3000
```

## Deploy on Render

1. On [Render](https://render.com) → **New** → **Static Site**
2. Connect the repo `Alex3925/WYN-S-ONLINE-STORE`
3. Settings:
   - **Build Command**: leave empty
   - **Publish Directory**: `.` (root)
4. Deploy.

## Customize

### 1. Your Maya QR code

Save your Maya / QR PH image as:

```
assets/maya-qr.png
```

It will appear automatically on the checkout page.

### 2. Telegram link

In `checkout.html` find:

```js
const TELEGRAM_LINK = "https://t.me/YOUR_TELEGRAM";
```

Replace with your real username, e.g. `https://t.me/wynstore`.

### 3. Add more products

Edit `js/products.js`:

```js
{
  id: "new-service",
  name: "NEW SERVICE",
  price: 200,
  category: "Rooting",
  description: "Short description...",
  tags: ["keyword1", "keyword2"]
}
```

Also add the new category name to the `CATEGORIES` array if needed.

## How the flow works

1. Customer browses / searches / adds to cart.
2. Checkout → scans your Maya QR and pays the shown amount.
3. Clicks **I've Paid — Create Order** → gets an Order ID (saved in browser).
4. Messages you on Telegram with the Order ID + optional note/device info.
5. You deliver the service manually on Telegram.

Orders are stored only in the customer's browser (localStorage). No backend required.

## Tech

Pure HTML + CSS + vanilla JS. No build step, no framework, no database.

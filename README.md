# FLUX ROOT SERVICES

Professional digital phone services storefront — Root, Unlock Bootloader, Firmware, and more.

**Pay via Maya QR PH · Delivery via Telegram**

## Features

- Product catalog with categories & search
- Cart (localStorage)
- Checkout with Maya QR + order creation
- Order history (saved on the device)
- Mobile-friendly dark UI
- Ready for Render (static site)

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

### 2. Telegram link

In `checkout.html` find:

```js
const TELEGRAM_LINK = "https://t.me/YOUR_TELEGRAM";
```

Replace with your real username.

### 3. Add more products

Edit `js/products.js`.

## Tech

Pure HTML + CSS + vanilla JS. No build step, no framework, no database.

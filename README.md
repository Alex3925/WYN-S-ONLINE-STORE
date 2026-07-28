# FLUX ROOT SERVICES

Professional digital phone services storefront — Root, Unlock Bootloader, Firmware, and more.

**Pay via Maya QR PH · Auto Telegram notify · Delivery via Telegram**

## Features

- Product catalog with categories & search
- Cart + order history (localStorage)
- Checkout with Maya QR
- **Telegram bot notification** when a customer places an order
- Hosted on Render (Node web service)

---

## 1. Create your Telegram bot

1. Open Telegram → search **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** (looks like `7123456789:AAH...`)
4. Start a chat with your new bot and press **Start**
5. Get your **Chat ID**:
   - Open this URL in a browser (replace TOKEN):
     `https://api.telegram.org/botTOKEN/getUpdates`
   - Look for `"chat":{"id": 123456789` — that number is your Chat ID  
   - Or message **@userinfobot** — it replies with your ID

---

## 2. Deploy on Render (Web Service)

This project needs a **Web Service** (not Static Site) so the bot token stays private.

1. [render.com](https://render.com) → **New** → **Web Service**
2. Connect repo `Alex3925/WYN-S-ONLINE-STORE`
3. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. **Environment Variables** (Render → Environment):

   | Key | Value |
   |-----|--------|
   | `TELEGRAM_BOT_TOKEN` | your bot token from BotFather |
   | `TELEGRAM_CHAT_ID` | your numeric chat ID |

5. Deploy

When a customer clicks **I've Paid — Create Order**, you get a Telegram message with order ID, total, items, ref, and notes.

---

## 3. Customize the storefront

### Maya QR
Upload your image as `assets/maya-qr.png`

### Telegram link (fallback button)
In `checkout.html`:
```js
const TELEGRAM_LINK = "https://t.me/YOUR_USERNAME";
```

### Products
Edit `js/products.js`

---

## Local test

```bash
export TELEGRAM_BOT_TOKEN=your_token
export TELEGRAM_CHAT_ID=your_chat_id
npm install
npm start
```

Open http://localhost:3000

---

## Tech

- Frontend: HTML / CSS / vanilla JS
- Backend: Express (`/api/order` → Telegram Bot API)
- Secrets only on the server (env vars)

# FLUX ROOT SERVICES

Digital phone services storefront with **Neon Postgres**, Maya QR checkout, and Telegram alerts.

## Features

- Product catalog, search, categories, cart
- Checkout → saves order to **Neon** + notifies Telegram
- Customer order lookup by Telegram username (live status)
- **Admin panel** (`/admin.html`) — mark orders completed
- Dark gold minimal UI

## Setup

### 1. Neon database (free)

1. Create account at [neon.tech](https://neon.tech)
2. **New Project** → copy the **connection string**  
   (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)
3. You do **not** need to create tables — the app creates them on start.

### 2. Telegram bot

1. @BotFather → `/newbot` → copy token  
2. Message your bot, get chat ID via `getUpdates` or @userinfobot

### 3. Render Web Service

| Setting | Value |
|--------|--------|
| Runtime | Node |
| Build | `npm install` |
| Start | `node server.js` |

**Environment variables:**

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon connection string |
| `TELEGRAM_BOT_TOKEN` | Bot token |
| `TELEGRAM_CHAT_ID` | Your numeric chat ID |
| `ADMIN_SECRET` | Password for `/admin.html` (pick a strong one) |

### 4. After deploy

- Shop: `/`
- Orders lookup: `/orders.html`
- Admin: `/admin.html` (login with `ADMIN_SECRET`)
- Health check: `/api/health` → should show `"db": true`

### 5. Customize

- Maya QR → `assets/maya-qr.png`
- Products → `js/products.js`
- Telegram link in `checkout.html` → already `@alexdevyuhhh`

## Local

```bash
export DATABASE_URL="postgresql://..."
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
export ADMIN_SECRET=mysecret
npm install
npm start
```

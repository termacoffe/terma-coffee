# ☕ Terma Coffee — Online Shop

Full-stack coffee shop for Terma Coffee (Balaju-16, Kathmandu): storefront with
products, cart, checkout, **order tracking**, and an **admin order dashboard**.

> ⚠️ **This is a Node app, not a static site.** It needs a server to run (for
> orders, tracking and the admin panel). **GitHub Pages cannot run it** — deploy
> it to a free Node host like **Render** (steps below).

## Features
- Storefront: coffee beans, powder, moka pot & French press (size + colour options)
- Cart + checkout with server-side price calculation
- Customer order tracking (Pending → Confirmed → Packed → On the way → Delivered)
- Admin dashboard (`/admin`) to view orders and update status
- Orders also generate a WhatsApp confirmation link

## Run locally
```bash
npm install
npm start
# Store  → http://localhost:3000
# Admin  → http://localhost:3000/admin   (key: terma-admin)
```

## Configuration (environment variables)
| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port to listen on | `3000` |
| `ADMIN_KEY` | Password for the admin panel | `terma-admin` |
| `WHATSAPP` | Your WhatsApp number for order links | `9779767354091` |

## Deploy free on Render
1. Push this repo to GitHub.
2. On [render.com](https://render.com) → **New → Web Service** → connect this repo.
3. Settings: **Build** `npm install` · **Start** `npm start`.
4. Add env vars `ADMIN_KEY` (your own secret) and `WHATSAPP`.
5. Deploy → you get a public URL like `https://terma-coffee.onrender.com`.

> Note: on Render's free tier the SQLite file resets when the service restarts.
> For permanent order history, add a Render **persistent disk** or a hosted DB.

## Tech
Node.js · Express · better-sqlite3 · vanilla JS frontend (no build step).

// server.js — Terma Coffee storefront + ordering API + admin panel.
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { repo } from "./db.js";
import { seedProducts } from "./seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
// Change this in production: ADMIN_KEY=yourSecret node server.js
const ADMIN_KEY = process.env.ADMIN_KEY || "terma-admin";
// Your WhatsApp number — used to build order confirmation links.
const WHATSAPP = process.env.WHATSAPP || "9779767354091";

app.use(express.json());
app.use((req, _res, next) => {
  console.log(`\x1b[90m${new Date().toISOString().slice(11, 19)}\x1b[0m  ${req.method.padEnd(6)} ${req.url}`);
  next();
});

// Seed the catalog on first run.
if (repo.isEmpty()) {
  seedProducts.forEach((p, i) => repo.addProduct(p, i));
  console.log(`\x1b[32m✓ seeded ${seedProducts.length} products\x1b[0m`);
}

const ok = (res, data, code = 200) => res.status(code).json({ data });
const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });

// Build a WhatsApp deep link with the full order, so staff/customer can confirm.
function whatsappLink(order) {
  const lines = order.items.map(
    (i) => `• ${i.product_name} (${i.variant_label}${i.color ? ", " + i.color : ""}) ×${i.qty} — Rs. ${i.line_total.toLocaleString("en-IN")}`
  );
  const msg =
    `🛒 *Terma Coffee — Order #${order.id}*\n` +
    `👤 ${order.customer_name}\n📞 ${order.phone}\n` +
    (order.address ? `📍 ${order.address}\n` : "") +
    `\n${lines.join("\n")}\n\n` +
    `Subtotal: Rs. ${order.subtotal_npr.toLocaleString("en-IN")}\n` +
    `Delivery: ${order.delivery_npr ? "Rs. " + order.delivery_npr : "FREE"}\n` +
    `*Total: Rs. ${order.total_npr.toLocaleString("en-IN")}*\n` +
    `Payment: ${order.payment === "online" ? "Online (QR)" : "Cash on Delivery"}` +
    (order.note ? `\n\nNote: ${order.note}` : "");
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

// --- admin auth middleware ---
function requireAdmin(req, res, next) {
  const key = req.get("x-admin-key") || req.query.key;
  if (key !== ADMIN_KEY) return fail(res, "Unauthorized", 401);
  next();
}

// ================= PUBLIC API =================
const api = express.Router();

api.get("/config", (_req, res) =>
  ok(res, { delivery: repo.deliveryConfig, whatsapp: WHATSAPP }));

api.get("/products", (req, res) => ok(res, repo.listProducts(req.query.category)));

api.get("/products/:id", (req, res) => {
  const p = repo.getProduct(Number(req.params.id));
  return p ? ok(res, p) : fail(res, "Product not found", 404);
});

api.post("/orders", (req, res) => {
  try {
    const order = repo.createOrder(req.body);
    return ok(res, { order, whatsapp: whatsappLink(order) }, 201);
  } catch (e) {
    return fail(res, e.message);
  }
});

// Public order tracking — requires the phone used on the order (light privacy).
const digits = (s) => String(s || "").replace(/\D/g, "");
api.get("/track/:id", (req, res) => {
  const order = repo.getOrder(Number(req.params.id));
  if (!order) return fail(res, "We couldn't find that order number.", 404);
  const phone = digits(req.query.phone);
  if (!phone || digits(order.phone) !== phone)
    return fail(res, "That phone number doesn't match this order.", 403);
  return ok(res, order);
});

// ================= ADMIN API =================
api.get("/admin/login", requireAdmin, (_req, res) => ok(res, { ok: true }));
api.get("/admin/stats", requireAdmin, (_req, res) => ok(res, repo.stats()));
api.get("/admin/orders", requireAdmin, (req, res) => ok(res, repo.listOrders(req.query.status)));
api.patch("/admin/orders/:id", requireAdmin, (req, res) => {
  try {
    const updated = repo.setOrderStatus(Number(req.params.id), req.body.status);
    return updated ? ok(res, updated) : fail(res, "Order not found", 404);
  } catch (e) {
    return fail(res, e.message);
  }
});

app.use("/api", api);

// ================= STATIC =================
app.get("/admin", (_req, res) => res.sendFile(join(__dirname, "public", "admin.html")));
app.use(express.static(join(__dirname, "public")));
app.use((req, res) => {
  if (req.url.startsWith("/api")) return fail(res, "Not found", 404);
  res.sendFile(join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n\x1b[33m☕ Terma Coffee → http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36m🔐 Admin panel  → http://localhost:${PORT}/admin   (key: ${ADMIN_KEY})\x1b[0m\n`);
});

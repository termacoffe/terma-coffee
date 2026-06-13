// db.js — SQLite data layer for the Terma Coffee shop.
// Three tables: products, product_variants, and orders/order_items.
// All money is stored in whole NPR rupees (integers).

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "terma.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,            -- beans | powder | brewing
    tagline     TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    emoji       TEXT NOT NULL DEFAULT '',
    gradient    TEXT NOT NULL DEFAULT '',
    specs       TEXT NOT NULL DEFAULT '{}', -- JSON object
    colors      TEXT NOT NULL DEFAULT '[]', -- JSON array of colour choices
    sort        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS product_variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    price_npr  INTEGER NOT NULL,
    sort       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone         TEXT NOT NULL,
    address       TEXT NOT NULL DEFAULT '',
    note          TEXT NOT NULL DEFAULT '',
    subtotal_npr  INTEGER NOT NULL,
    delivery_npr  INTEGER NOT NULL DEFAULT 0,
    total_npr     INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending', -- pending|confirmed|delivered|cancelled
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name  TEXT NOT NULL,
    variant_label TEXT NOT NULL,
    color         TEXT NOT NULL DEFAULT '',
    unit_price    INTEGER NOT NULL,
    qty           INTEGER NOT NULL,
    line_total    INTEGER NOT NULL
  );
`);

const ORDER_STATUSES = ["pending", "confirmed", "packed", "on_the_way", "delivered", "cancelled"];

// Free delivery inside the valley over this amount, else a flat fee.
const DELIVERY_FEE = 100;
const FREE_DELIVERY_OVER = 2000;

// ---------- products ----------
function variantsFor(productId) {
  return db.prepare(
    `SELECT id, label, price_npr AS price FROM product_variants
     WHERE product_id = ? ORDER BY sort, id`
  ).all(productId);
}

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    specs: JSON.parse(row.specs || "{}"),
    colors: JSON.parse(row.colors || "[]"),
    variants: variantsFor(row.id),
  };
}

// ---------- order validation/creation ----------
const variantById = db.prepare(
  `SELECT v.id, v.label, v.price_npr, p.name AS product_name, p.colors AS colors
   FROM product_variants v JOIN products p ON p.id = v.product_id
   WHERE v.id = ?`
);

const insertOrder = db.prepare(`
  INSERT INTO orders (customer_name, phone, address, note, subtotal_npr, delivery_npr, total_npr)
  VALUES (@customer_name, @phone, @address, @note, @subtotal, @delivery, @total)
`);
const insertItem = db.prepare(`
  INSERT INTO order_items (order_id, product_name, variant_label, color, unit_price, qty, line_total)
  VALUES (@order_id, @product_name, @variant_label, @color, @unit_price, @qty, @line_total)
`);

// Wrapped in a transaction so an order is all-or-nothing.
const createOrderTxn = db.transaction((order, lines) => {
  const info = insertOrder.run(order);
  const orderId = info.lastInsertRowid;
  for (const ln of lines) insertItem.run({ ...ln, order_id: orderId });
  return orderId;
});

export const repo = {
  orderStatuses: ORDER_STATUSES,
  deliveryConfig: { fee: DELIVERY_FEE, freeOver: FREE_DELIVERY_OVER },

  isEmpty() {
    return db.prepare(`SELECT COUNT(*) AS n FROM products`).get().n === 0;
  },

  // Insert a product + its variants (used by the seeder).
  addProduct(p, sort) {
    const info = db.prepare(`
      INSERT INTO products (name, category, tagline, description, emoji, gradient, specs, colors, sort)
      VALUES (@name, @category, @tagline, @description, @emoji, @gradient, @specs, @colors, @sort)
    `).run({
      name: p.name, category: p.category, tagline: p.tagline ?? "",
      description: p.description ?? "", emoji: p.emoji ?? "", gradient: p.gradient ?? "",
      specs: JSON.stringify(p.specs ?? {}), colors: JSON.stringify(p.colors ?? []), sort,
    });
    p.variants.forEach((v, i) =>
      db.prepare(`INSERT INTO product_variants (product_id, label, price_npr, sort) VALUES (?,?,?,?)`)
        .run(info.lastInsertRowid, v.label, v.price, i));
  },

  listProducts(category) {
    const rows = category
      ? db.prepare(`SELECT * FROM products WHERE category = ? ORDER BY sort, id`).all(category)
      : db.prepare(`SELECT * FROM products ORDER BY sort, id`).all();
    return rows.map(hydrate);
  },

  getProduct(id) {
    return hydrate(db.prepare(`SELECT * FROM products WHERE id = ?`).get(id));
  },

  // Core ordering logic — prices come from the DB, never from the client.
  createOrder({ customer = {}, items = [] }) {
    const name = String(customer.name ?? "").trim().slice(0, 80);
    const phone = String(customer.phone ?? "").trim().slice(0, 30);
    if (!name) throw new Error("Customer name is required");
    if (!/[0-9]{7,}/.test(phone)) throw new Error("A valid phone number is required");
    if (!Array.isArray(items) || items.length === 0) throw new Error("Your cart is empty");

    const lines = [];
    let subtotal = 0;
    for (const item of items) {
      const v = variantById.get(Number(item.variantId));
      if (!v) throw new Error("A product in your cart is no longer available");
      const qty = Math.min(99, Math.max(1, parseInt(item.qty, 10) || 1));

      // If the product offers colours, one must be chosen and valid.
      const allowed = JSON.parse(v.colors || "[]");
      let color = "";
      if (allowed.length) {
        color = String(item.color ?? "").trim();
        if (!allowed.includes(color))
          throw new Error(`Please choose a colour for ${v.product_name}`);
      }

      const lineTotal = v.price_npr * qty;
      subtotal += lineTotal;
      lines.push({
        product_name: v.product_name, variant_label: v.label, color,
        unit_price: v.price_npr, qty, line_total: lineTotal,
      });
    }

    const delivery = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
    const total = subtotal + delivery;

    const orderId = createOrderTxn(
      {
        customer_name: name, phone,
        address: String(customer.address ?? "").trim().slice(0, 300),
        note: String(customer.note ?? "").trim().slice(0, 500),
        subtotal, delivery, total,
      },
      lines
    );
    return this.getOrder(orderId);
  },

  getOrder(id) {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
    if (!order) return null;
    order.items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(id);
    return order;
  },

  listOrders(status) {
    const rows = status && ORDER_STATUSES.includes(status)
      ? db.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY id DESC`).all(status)
      : db.prepare(`SELECT * FROM orders ORDER BY id DESC`).all();
    const byOrder = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
    return rows.map((o) => ({ ...o, items: byOrder.all(o.id) }));
  },

  setOrderStatus(id, status) {
    if (!ORDER_STATUSES.includes(status)) throw new Error("Invalid status");
    const changed = db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, id).changes;
    return changed > 0 ? this.getOrder(id) : null;
  },

  // Admin dashboard numbers.
  stats() {
    const t = db.prepare(`
      SELECT
        COUNT(*) AS orders,
        COALESCE(SUM(CASE WHEN status!='cancelled' THEN total_npr ELSE 0 END),0) AS revenue,
        COALESCE(SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END),0) AS pending,
        COALESCE(SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END),0) AS delivered
      FROM orders
    `).get();
    const top = db.prepare(`
      SELECT product_name, SUM(qty) AS units, SUM(line_total) AS revenue
      FROM order_items GROUP BY product_name ORDER BY units DESC LIMIT 5
    `).all();
    return { ...t, top };
  },
};

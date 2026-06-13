// app.js — Terma Coffee storefront logic.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const api = {
  async get(p) { const r = await fetch("/api" + p); return r.json(); },
  async post(p, body) {
    const r = await fetch("/api" + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed"); return j;
  },
};

const rs = (n) => "Rs. " + Number(n).toLocaleString("en-IN");

// ---------- product imagery ----------
const imgUrl = (id, w = 600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;
const IMG = {
  beans: imgUrl("1447933601403-0c6688de566e", 800),                                  // roasted whole beans
  powder: "https://truesouth.in/cdn/shop/files/southindian2.jpg?v=1707477021",        // coffee powder
  moka: "https://mywirsh.com/cdn/shop/articles/Moka_Pot_MasteryHow_to_Avoid_Burnt_Coffee_and_Achieve_Espresso-Like_Crema_at_Home_b49cf4de-81e0-4701-9c7b-60cd39071a12.jpg?v=1780367538",
  frenchpress: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/French_press_2020.jpg/500px-French_press_2020.jpg",
};
function imageFor(p) {
  if (p.category === "beans") return IMG.beans;
  if (p.category === "powder") return IMG.powder;
  const n = p.name.toLowerCase();
  if (n.includes("french")) return IMG.frenchpress;
  return IMG.moka; // moka pot (and fallback)
}

// ---------- order status flow ----------
const STATUS_FLOW = ["pending", "confirmed", "packed", "on_the_way", "delivered"];
const STATUS_META = {
  pending:    { label: "Pending",    icon: "fa-clock",          desc: "We've received your order." },
  confirmed:  { label: "Confirmed",  icon: "fa-circle-check",   desc: "Your order is confirmed." },
  packed:     { label: "Packed",     icon: "fa-box",            desc: "Packed and ready to ship." },
  on_the_way: { label: "On the way", icon: "fa-truck-fast",     desc: "Out for delivery to you." },
  delivered:  { label: "Delivered",  icon: "fa-house-circle-check", desc: "Delivered. Enjoy your coffee! ☕" },
  cancelled:  { label: "Cancelled",  icon: "fa-circle-xmark",   desc: "This order was cancelled." },
};
const toast = (msg, err = false) => {
  const el = document.createElement("div");
  el.className = "toast" + (err ? " err" : ""); el.textContent = msg;
  $("#toasts").appendChild(el); setTimeout(() => el.remove(), 3000);
};

// ---------- state ----------
let products = [];
let config = { delivery: { fee: 100, freeOver: 2000 }, whatsapp: "9779767354091" };
let cart = JSON.parse(localStorage.getItem("terma_cart") || "[]"); // [{variantId, qty}]
let detail = { product: null, variant: null, qty: 1 };

const saveCart = () => localStorage.setItem("terma_cart", JSON.stringify(cart));

// ---------- load ----------
async function init() {
  $("#year").textContent = "2026";
  try {
    const [prodRes, cfgRes] = await Promise.all([api.get("/products"), api.get("/config")]);
    products = prodRes.data; config = cfgRes.data;
  } catch (e) { toast("Could not load shop: " + e.message, true); return; }
  renderCatalog();
  updateCartBadge();
}

// ---------- catalog ----------
function cardHTML(p) {
  const from = Math.min(...p.variants.map((v) => v.price));
  const multi = p.variants.length > 1;
  return `<div class="card" data-id="${p.id}">
    <div class="card-visual" style="background:${p.gradient}">
      <img src="${imageFor(p)}" alt="${p.name}" loading="lazy" />
    </div>
    <div class="card-body">
      <h3>${p.name}</h3>
      <span class="ptag">${p.tagline}</span>
      <p class="pdesc">${p.description}</p>
      <div class="card-foot">
        <span class="price">${multi ? "<small>from </small>" : ""}${rs(from)}</span>
        <button class="add-mini" data-add="${p.id}" title="Quick add">+</button>
      </div>
    </div>
  </div>`;
}

function renderCatalog() {
  for (const cat of ["beans", "powder", "brewing"]) {
    const grid = $(`.product-grid[data-cat="${cat}"]`);
    if (!grid) continue;
    const list = products.filter((p) => p.category === cat);
    grid.innerHTML = list.map(cardHTML).join("");
    $$(".card", grid).forEach((c) => c.addEventListener("click", (e) => {
      if (e.target.dataset.add) return;
      openDetail(Number(c.dataset.id));
    }));
    $$("[data-add]", grid).forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(); quickAdd(Number(b.dataset.add));
    }));
  }
}

// ---------- product detail ----------
const CAT_LABEL = { beans: "Coffee Beans", powder: "Coffee Powder", brewing: "Coffee Machine" };
function openDetail(id) {
  const p = products.find((x) => x.id === id); if (!p) return;
  detail = { product: p, variant: p.variants[0], qty: 1, color: (p.colors && p.colors[0]) || "" };
  $("#detailVisual").style.background = p.gradient;
  $("#detailVisual").innerHTML = `<img src="${imageFor(p)}" alt="${p.name}" />`;
  $("#detailCat").textContent = CAT_LABEL[p.category] || p.category;
  $("#detailName").textContent = p.name;
  $("#detailTag").textContent = p.tagline;
  $("#detailDesc").textContent = p.description;

  // size / weight variants
  $("#detailVariantWrap .opt-label").textContent = p.category === "brewing" ? "Size" : "Weight";
  $("#detailVariants").innerHTML = p.variants
    .map((v, i) => `<button class="variant-chip ${i === 0 ? "active" : ""}" data-v="${v.id}">${v.label}</button>`).join("");
  $$("#detailVariants .variant-chip").forEach((b) => b.addEventListener("click", () => {
    detail.variant = p.variants.find((v) => v.id === Number(b.dataset.v));
    $$("#detailVariants .variant-chip").forEach((x) => x.classList.toggle("active", x === b));
    syncDetailPrice();
  }));

  // colour choices (only products that offer them)
  const hasColors = p.colors && p.colors.length;
  $("#detailColorWrap").hidden = !hasColors;
  if (hasColors) {
    $("#detailColors").innerHTML = p.colors.map((c, i) =>
      `<button class="color-chip ${i === 0 ? "active" : ""}" data-c="${c}"><span class="swatch sw-${c.toLowerCase()}"></span>${c}</button>`).join("");
    $$("#detailColors .color-chip").forEach((b) => b.addEventListener("click", () => {
      detail.color = b.dataset.c;
      $$("#detailColors .color-chip").forEach((x) => x.classList.toggle("active", x === b));
    }));
  }

  // specs
  $("#detailSpecs").innerHTML = Object.entries(p.specs)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  syncDetailPrice();
  show("#productModal");
}
function syncDetailPrice() {
  $("#detailQty").textContent = detail.qty;
  $("#detailPrice").textContent = rs(detail.variant.price * detail.qty);
}

// ---------- cart ops ----------
// A cart line is unique by variant + colour, so e.g. a black and a red moka pot are separate lines.
function addToCart(variantId, qty = 1, color = "") {
  const existing = cart.find((c) => c.variantId === variantId && (c.color || "") === (color || ""));
  if (existing) existing.qty = Math.min(99, existing.qty + qty);
  else cart.push({ variantId, qty, color });
  saveCart(); updateCartBadge();
}
function quickAdd(productId) {
  // The "+" opens the product just like clicking the card, so the
  // customer always chooses the exact size (and colour where needed).
  openDetail(productId);
}
function cartDetailed() {
  // join cart with product/variant info; keep the cart index for edits
  return cart.map((c, idx) => {
    for (const p of products) {
      const v = p.variants.find((v) => v.id === c.variantId);
      if (v) return { ...c, idx, product: p, variant: v, lineTotal: v.price * c.qty };
    }
    return null;
  }).filter(Boolean);
}
function cartTotals() {
  const items = cartDetailed();
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const delivery = items.length === 0 ? 0 : subtotal >= config.delivery.freeOver ? 0 : config.delivery.fee;
  return { items, subtotal, delivery, total: subtotal + delivery };
}
function updateCartBadge() {
  const n = cart.reduce((s, c) => s + c.qty, 0);
  $("#cartCount").textContent = n;
}

// ---------- cart drawer ----------
function renderCart() {
  const { items, subtotal, delivery, total } = cartTotals();
  const wrap = $("#cartItems");
  if (!items.length) {
    wrap.innerHTML = `<div class="cart-empty">Your cart is empty.<br/>Add some coffee ☕</div>`;
    $("#cartFoot").style.display = "none"; return;
  }
  $("#cartFoot").style.display = "block";
  wrap.innerHTML = items.map((i) => `
    <div class="ci">
      <div class="ci-thumb"><img src="${imageFor(i.product)}" alt="" /></div>
      <div class="ci-info">
        <h4>${i.product.name}</h4>
        <div class="ci-var">${i.variant.label}${i.color ? " · " + i.color : ""}</div>
        <div class="ci-price">${rs(i.lineTotal)}</div>
      </div>
      <div class="ci-qty">
        <button data-dec="${i.idx}">−</button><span>${i.qty}</span><button data-inc="${i.idx}">+</button>
      </div>
      <button class="ci-rm" data-rm="${i.idx}"><i class="fa-solid fa-trash"></i></button>
    </div>`).join("");
  $("#cartSubtotal").textContent = rs(subtotal);
  $("#cartDelivery").textContent = delivery ? rs(delivery) : "FREE";
  $("#cartTotal").textContent = rs(total);

  $$("[data-inc]", wrap).forEach((b) => b.onclick = () => changeQty(Number(b.dataset.inc), 1));
  $$("[data-dec]", wrap).forEach((b) => b.onclick = () => changeQty(Number(b.dataset.dec), -1));
  $$("[data-rm]", wrap).forEach((b) => b.onclick = () => removeItem(Number(b.dataset.rm)));
}
function changeQty(idx, d) {
  const it = cart[idx]; if (!it) return;
  it.qty += d;
  if (it.qty < 1) cart.splice(idx, 1);
  saveCart(); updateCartBadge(); renderCart();
}
function removeItem(idx) {
  cart.splice(idx, 1);
  saveCart(); updateCartBadge(); renderCart();
}

// ---------- checkout ----------
function openCheckout() {
  const { items, subtotal, delivery, total } = cartTotals();
  if (!items.length) return toast("Your cart is empty", true);
  $("#checkoutSummary").innerHTML =
    items.map((i) => `<div class="cs-line"><span>${i.product.name} (${i.variant.label}${i.color ? ", " + i.color : ""}) ×${i.qty}</span><span>${rs(i.lineTotal)}</span></div>`).join("") +
    `<div class="cs-line"><span>Delivery</span><span>${delivery ? rs(delivery) : "FREE"}</span></div>` +
    `<div class="cs-line cs-total"><span>Total</span><span>${rs(total)}</span></div>`;
  hide("#cartDrawer"); show("#checkoutModal");
}

async function placeOrder(e) {
  e.preventDefault();
  const btn = $("#placeOrderBtn");
  btn.disabled = true; btn.textContent = "Placing order…";
  try {
    const payload = {
      customer: {
        name: $("#c-name").value, phone: $("#c-phone").value,
        address: $("#c-address").value, note: $("#c-note").value,
      },
      items: cart,
    };
    const { data } = await api.post("/orders", payload);
    cart = []; saveCart(); updateCartBadge();
    $("#checkoutForm").reset();
    hide("#checkoutModal");
    // remember this order so the customer can track it later
    localStorage.setItem("terma_last_order", JSON.stringify({ id: data.order.id, phone: data.order.phone }));
    $("#successId").textContent = "#" + data.order.id;
    $("#successWhatsapp").href = data.whatsapp;
    show("#successModal");
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = "Place order";
  }
}

// ---------- order tracking ----------
function openTrack(prefill) {
  $("#trackResult").innerHTML = "";
  const last = prefill || JSON.parse(localStorage.getItem("terma_last_order") || "null");
  if (last) { $("#t-id").value = last.id; $("#t-phone").value = last.phone; }
  show("#trackModal");
  if (last) doTrack(); // auto-track if we know the last order
}

async function doTrack(e) {
  if (e) e.preventDefault();
  const id = $("#t-id").value.trim();
  const phone = $("#t-phone").value.trim();
  if (!id || !phone) return;
  const btn = $("#trackBtn"); btn.disabled = true; btn.textContent = "…";
  try {
    const { data } = await api.get(`/track/${encodeURIComponent(id)}?phone=${encodeURIComponent(phone)}`);
    renderTracking(data);
  } catch (err) {
    $("#trackResult").innerHTML = `<p class="track-err">${err.message}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = "Track";
  }
}

function renderTracking(o) {
  const items = o.items.map((i) => `${i.product_name} (${i.variant_label}${i.color ? ", " + i.color : ""}) ×${i.qty}`).join(", ");
  let body;
  if (o.status === "cancelled") {
    body = `<div class="tl-cancelled"><i class="fa-solid fa-circle-xmark"></i> This order was cancelled.</div>`;
  } else {
    const currentIdx = STATUS_FLOW.indexOf(o.status);
    body = `<div class="timeline">` + STATUS_FLOW.map((s, idx) => {
      const m = STATUS_META[s];
      const cls = idx < currentIdx ? "done" : idx === currentIdx ? "done current" : "";
      const icon = idx <= currentIdx ? "fa-solid fa-check" : "fa-solid " + m.icon;
      return `<div class="tl-step ${cls}">
        <div class="tl-dot"><i class="${icon}"></i></div>
        <div class="tl-text"><h5>${m.label}</h5><p>${m.desc}</p></div>
      </div>`;
    }).join("") + `</div>`;
  }
  $("#trackResult").innerHTML = `
    <div class="track-card">
      <div class="tc-top"><h4>Order #${o.id}</h4><span class="pill s-${o.status}">${STATUS_META[o.status].label}</span></div>
      <div class="tc-meta">${items}</div>
      ${body}
      <div class="tc-total"><span>Total</span><span>${rs(o.total_npr)}</span></div>
    </div>`;
}

// ---------- overlay helpers ----------
function show(sel) { $(sel).hidden = false; document.body.style.overflow = "hidden"; }
function hide(sel) { $(sel).hidden = true; if (!$$(".overlay:not([hidden])").length) document.body.style.overflow = ""; }

// ---------- wire up ----------
// Products stay hidden until a category is chosen.
function openCategory(sectionId) {
  $$(".catalog").forEach((s) => { s.hidden = s.id !== sectionId; });
  const sec = $("#" + sectionId);
  if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
}
$$("[data-open-cat]").forEach((el) => el.addEventListener("click", (e) => {
  e.preventDefault();
  openCategory(el.dataset.openCat);
}));

// Mobile hamburger menu
const navMenu = $("#navMenu");
$("#navToggle").addEventListener("click", () => navMenu.classList.toggle("open"));
$$("#navMenu a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));

$("#brandLink").addEventListener("click", () => show("#storyModal"));
$("#cartBtn").addEventListener("click", () => { renderCart(); show("#cartDrawer"); });
$("#trackLink").addEventListener("click", (e) => { e.preventDefault(); openTrack(); });
$("#trackForm").addEventListener("submit", doTrack);
$("#successTrack").addEventListener("click", () => { hide("#successModal"); openTrack(); });
$("#checkoutBtn").addEventListener("click", openCheckout);
$("#checkoutForm").addEventListener("submit", placeOrder);
$("#addToCartBtn").addEventListener("click", () => {
  if (detail.product.colors?.length && !detail.color) return toast("Please choose a colour", true);
  addToCart(detail.variant.id, detail.qty, detail.color);
  toast(`${detail.product.name} added to cart`);
  hide("#productModal");
});
$$("[data-qty]").forEach((b) => b.addEventListener("click", () => {
  detail.qty = Math.min(99, Math.max(1, detail.qty + Number(b.dataset.qty)));
  syncDetailPrice();
}));

// close handlers (X buttons, backdrop click, Escape)
$$(".overlay").forEach((ov) => {
  ov.addEventListener("click", (e) => { if (e.target === ov) hide("#" + ov.id); });
  $$("[data-close]", ov).forEach((b) => b.addEventListener("click", () => hide("#" + ov.id)));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".overlay:not([hidden])").forEach((ov) => hide("#" + ov.id));
});

init();

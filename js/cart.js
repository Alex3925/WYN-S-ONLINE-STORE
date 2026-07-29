const CART_KEY = "flux_cart";
const ORDERS_KEY = "flux_orders";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function resolveProduct(productId) {
  if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return null;
  return PRODUCTS.find((x) => x.id === productId) || null;
}

function addToCart(productId, qty = 1) {
  const p = resolveProduct(productId);
  const price = p ? Number(p.price) || 0 : 0;
  const name = p ? p.name : productId;
  const cart = getCart();
  const existing = cart.find((i) => i.id === productId);
  if (existing) {
    existing.qty += qty;
    if (p) {
      existing.price = price;
      existing.name = name;
    }
  } else {
    cart.push({ id: productId, qty, name, price });
  }
  saveCart(cart);
  showToast("Added to cart");
}

function removeFromCart(productId) {
  saveCart(getCart().filter((i) => i.id !== productId));
}

function setQty(productId, qty) {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  if (qty <= 0) {
    removeFromCart(productId);
  } else {
    item.qty = qty;
    saveCart(cart);
  }
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

/** Sync name/price from catalog into cart lines (fixes ₱0 after product load). */
function syncCartPrices() {
  if (typeof PRODUCTS === "undefined" || !PRODUCTS.length) return;
  const cart = getCart();
  let changed = false;
  for (const item of cart) {
    const p = PRODUCTS.find((x) => x.id === item.id);
    if (p) {
      const price = Number(p.price) || 0;
      if (item.price !== price || item.name !== p.name) {
        item.price = price;
        item.name = p.name;
        changed = true;
      }
    }
  }
  if (changed) saveCart(cart);
}

function linePrice(item) {
  const p = resolveProduct(item.id);
  if (p && Number(p.price) > 0) return Number(p.price);
  return Number(item.price) || 0;
}

function lineName(item) {
  const p = resolveProduct(item.id);
  if (p && p.name) return p.name;
  return item.name || item.id;
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + linePrice(item) * item.qty, 0);
}

function getCartCount() {
  return getCart().reduce((n, i) => n + i.qty, 0);
}

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll(".cart-count").forEach((badge) => {
    badge.textContent = count;
    badge.style.display = count > 0 ? "flex" : "none";
  });
}

function getOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveOrder(order) {
  const orders = getOrders();
  orders.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function updateOrderStatus(orderId, status) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) return false;
  order.status = status;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  return true;
}

function generateOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FLUX-${t}-${r}`;
}

function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

document.addEventListener("DOMContentLoaded", updateCartBadge);

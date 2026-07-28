const CATEGORY_ICONS = {
  Rooting: "🔓",
  Unlock: "🔑",
  Firmware: "📦",
  default: "⚡"
};

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("products");
  const searchInput = document.getElementById("search");
  const catContainer = document.getElementById("categories");

  if (!grid) return;

  await loadProducts();

  let activeCategory = "All";
  let searchQuery = "";

  function renderCategories() {
    catContainer.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn" + (cat === activeCategory ? " active" : "");
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        activeCategory = cat;
        renderCategories();
        render();
      });
      catContainer.appendChild(btn);
    });
  }

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    render();
  });

  function render() {
    const list = PRODUCTS.filter((p) => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery) ||
        (p.description || "").toLowerCase().includes(searchQuery) ||
        (p.tags && p.tags.some((t) => String(t).toLowerCase().includes(searchQuery)));
      return matchCat && matchSearch;
    });

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty" style="grid-column: 1 / -1">
          <div class="empty-icon">—</div>
          <h3>No services found</h3>
          <p>Try a different search or category.</p>
        </div>`;
      return;
    }

    grid.innerHTML = list
      .map((p) => {
        const icon = CATEGORY_ICONS[p.category] || CATEGORY_ICONS.default;
        return `
      <article class="product-card">
        <div class="product-top">
          <div class="product-icon">${icon}</div>
          <span class="product-cat">${escapeHtml(p.category)}</span>
        </div>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="product-footer">
          <div class="price">₱${Number(p.price).toLocaleString()}<span>PHP</span></div>
          <button class="btn btn-sm" onclick="addToCart('${p.id}')">Add to Cart</button>
        </div>
      </article>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  renderCategories();
  render();
});

const BOX_STORAGE_KEY = "vera-build-your-box-v1";
const BOX_DISCOUNT_PERCENT = { 3: 0, 5: 15, 8: 30 };
const NO_COLLECTION_MESSAGE =
  "Select a builder collection in Theme editor → Build Your Own Box → Builder product collection.";

let toastHideTimer = null;
let toastElement = null;

function hideToast() {
  if (!toastElement) return;

  clearTimeout(toastHideTimer);
  toastHideTimer = null;
  toastElement.classList.remove("is-visible");
}

function showToast(message, type = "error") {
  if (!toastElement) {
    toastElement = document.createElement("div");
    toastElement.className = "box-toast";
    toastElement.setAttribute("aria-atomic", "true");

    const messageElement = document.createElement("p");
    messageElement.className = "box-toast__message";

    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "box-toast__dismiss";
    dismissButton.setAttribute("aria-label", "Dismiss notification");
    dismissButton.textContent = "×";
    dismissButton.addEventListener("click", hideToast);

    toastElement.append(messageElement, dismissButton);
    document.body.append(toastElement);
  }

  const toastType = type === "success" || type === "info" ? type : "error";
  const isError = toastType === "error";

  toastElement.classList.remove("box-toast--error", "box-toast--success", "box-toast--info", "is-visible");
  toastElement.classList.add(`box-toast--${toastType}`);
  toastElement.setAttribute("role", isError ? "alert" : "status");
  toastElement.setAttribute("aria-live", isError ? "assertive" : "polite");
  toastElement.querySelector(".box-toast__message").textContent = message;

  void toastElement.offsetWidth;
  toastElement.classList.add("is-visible");

  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(hideToast, 3000);
}

function readJsonScript(id, fallback) {
  const element = document.getElementById(id);
  if (!element) return fallback;

  try {
    return JSON.parse(element.textContent);
  } catch (error) {
    console.error(`Could not read #${id}:`, error);
    return fallback;
  }
}

/** Ajax products.json uses major units ("45.00"). formatMoney uses minor units (4500). */
function toMinorUnits(raw) {
  if (raw == null || raw === "") return 0;

  const parsed = Number(String(raw).trim());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function shopCurrency() {
  const data = readJsonScript("box-shop-data", {});
  return data.currency || window.Shopify?.currency?.active || "USD";
}

function formatPrice(minorUnits) {
  const amount = Number(minorUnits);
  if (!Number.isFinite(amount)) return "—";

  const currency = shopCurrency();
  const shopData = readJsonScript("box-shop-data", {});
  const format = currency === "INR"
    ? "₹{{amount}}"
    : shopData.moneyFormat || window.Shopify?.money_format || "${{amount}}";

  if (typeof window.Shopify?.formatMoney === "function") {
    return window.Shopify.formatMoney(amount, format);
  }

  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : document.documentElement.lang || "en", {
    style: "currency",
    currency
  }).format(amount / 100);
}

function countById(items, id, key) {
  return items.filter((item) => String(item[key]) === String(id)).length;
}

function initializeBoxBuilder() {
  const container = document.querySelector("#box-builder");
  if (!container) return;

  const productsContainer = container.querySelector("#box-products");
  const summary = container.querySelector("#box-summary");
  const addButton = summary.querySelector(".box-summary__checkout");
  const inventory = readJsonScript("box-inventory-data", {});

  const state = { boxSize: 3, items: [] };
  let isAddingToCart = false;

  function saveState() {
    try {
      localStorage.setItem(BOX_STORAGE_KEY, JSON.stringify({
        boxSize: state.boxSize,
        items: state.items.map((item) => ({ id: item.id, variantId: item.variantId }))
      }));
    } catch (error) {
      console.error("Could not save builder state:", error);
    }
  }

  function readSavedState() {
    try {
      const saved = JSON.parse(localStorage.getItem(BOX_STORAGE_KEY) || "null");
      const validSize = saved && BOX_DISCOUNT_PERCENT[saved.boxSize] != null;

      if (!validSize || !Array.isArray(saved.items)) return null;
      return saved;
    } catch (error) {
      console.error("Could not restore builder state:", error);
      try {
        localStorage.removeItem(BOX_STORAGE_KEY);
      } catch (removeError) {
        console.error("Could not clear builder state:", removeError);
      }
      return null;
    }
  }

  function stockLimit(productId, variantId) {
    const stock = inventory[String(productId)]?.[String(variantId)];

    if (!stock || !stock.available) return 0;
    if (!stock.management || stock.policy === "continue") return null;
    return Number(stock.quantity);
  }

  function cartQuantity(cart, variantId) {
    if (!cart?.items?.length) return 0;

    return cart.items.reduce((total, line) => {
      if (String(line.variant_id) !== String(variantId)) return total;
      return total + line.quantity;
    }, 0);
  }

  function hasStock(item, extraInBox = 1, alreadyInCart = 0) {
    const limit = stockLimit(item.id, item.variantId);
    if (limit === 0) return false;
    if (limit === null) return true;

    return countById(state.items, item.variantId, "variantId") + extraInBox + alreadyInCart <= limit;
  }

  function variantCounts() {
    const counts = new Map();

    state.items.forEach((item) => {
      const id = String(item.variantId);
      counts.set(id, (counts.get(id) || 0) + 1);
    });

    return counts;
  }

  function selectionItem(product, variant) {
    return {
      id: product.id,
      title: product.title,
      variantId: variant.id,
      variantTitle: variant.title,
      price: Number(variant.price)
    };
  }

  function trimToBoxSize(showNotice) {
    if (state.items.length <= state.boxSize) return;

    const removedCount = state.items.length - state.boxSize;
    state.items = state.items.slice(0, state.boxSize);
    saveState();

    if (showNotice) {
      showToast(
        `Only ${state.boxSize} items fit in this box. ${removedCount} extra item(s) were removed.`,
        "info"
      );
    }
  }

  function restoreState(products) {
    const saved = readSavedState();
    if (!saved) return;

    const productsById = new Map(products.map((product) => [String(product.id), product]));
    state.boxSize = saved.boxSize;
    state.items = [];
    let dropped = false;

    saved.items.forEach((entry) => {
      const product = productsById.get(String(entry?.id));
      const variant = product?.variants.find((item) => String(item.id) === String(entry.variantId));
      const tooManyOfProduct = product && countById(state.items, product.id, "id") >= 2;
      const candidate = product && variant ? selectionItem(product, variant) : null;

      if (
        !entry ||
        state.items.length >= state.boxSize ||
        !variant?.available ||
        tooManyOfProduct ||
        !candidate ||
        !hasStock(candidate)
      ) {
        dropped = true;
        return;
      }

      state.items.push(candidate);
    });

    trimToBoxSize(false);
    if (dropped) saveState();
  }

  function pricing() {
    const subtotal = state.items.reduce((total, item) => total + Number(item.price), 0);
    const percent = BOX_DISCOUNT_PERCENT[state.boxSize] || 0;
    const complete = state.items.length === state.boxSize;
    const discount = complete ? Math.round(subtotal * (percent / 100)) : 0;

    return {
      subtotal,
      percent,
      complete,
      discount,
      total: subtotal - discount
    };
  }

  function updateSummary() {
    const count = state.items.length;
    const remaining = state.boxSize - count;
    const progressText = summary.querySelector("p");
    const itemsContainer = summary.querySelector(".box-summary__items");
    const totals = pricing();

    if (count > state.boxSize) {
      progressText.textContent = `${count}/${state.boxSize} items — remove ${count - state.boxSize} to continue`;
    } else if (remaining > 0) {
      progressText.textContent = `${count}/${state.boxSize} items selected — ${remaining} more to go`;
    } else {
      progressText.textContent = `${count}/${state.boxSize} items selected — ready to add`;
    }

    summary.querySelector(".box-summary__progress-fill").style.width =
      `${Math.min(100, (count / state.boxSize) * 100)}%`;

    itemsContainer.replaceChildren();

    if (count === 0) {
      itemsContainer.textContent = "Selected products will appear here.";
    }

    state.items.forEach((item, index) => {
      const row = document.createElement("div");
      const name = document.createElement("span");
      const removeButton = document.createElement("button");

      row.className = "box-summary__item";
      name.textContent = `${item.title} — ${item.variantTitle}`;
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        state.items.splice(index, 1);
        saveState();
        updateSummary();
      });

      row.append(name, removeButton);
      itemsContainer.append(row);
    });

    addButton.disabled = count !== state.boxSize;

    summary.querySelector(".box-summary__pricing-row--subtotal .box-summary__pricing-value").textContent =
      formatPrice(totals.subtotal);

    const discountLabel = summary.querySelector(".box-summary__pricing-row--discount .box-summary__pricing-label");
    const discountValue = summary.querySelector(".box-summary__pricing-row--discount .box-summary__pricing-value");

    if (totals.percent === 0) {
      discountLabel.textContent = "Discount";
      discountValue.textContent = formatPrice(0);
    } else if (totals.complete) {
      discountLabel.textContent = `Discount (${totals.percent}%)`;
      discountValue.textContent = `-${formatPrice(totals.discount)}`;
    } else {
      discountLabel.textContent = `Discount (${totals.percent}% when complete)`;
      discountValue.textContent = formatPrice(0);
    }

    summary.querySelector(".box-summary__pricing-row--total .box-summary__pricing-value").textContent =
      formatPrice(totals.total);
  }

  function selectBoxSize(size, persist) {
    state.boxSize = size;
    trimToBoxSize(persist);

    container.querySelectorAll("[data-box-size]").forEach((button) => {
      const selected = Number(button.dataset.boxSize) === size;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    updateSummary();
    if (persist) saveState();
  }

  function addProduct(item) {
    if (state.items.length >= state.boxSize) {
      showToast("Your box is full!", "error");
      return;
    }

    if (countById(state.items, item.id, "id") >= 2) {
      showToast("Maximum 2 of the same product allowed!", "error");
      return;
    }

    if (!hasStock(item)) {
      showToast("This variant has reached its available stock limit.", "error");
      return;
    }

    state.items.push(item);
    saveState();
    updateSummary();
  }

  function boxAlreadyInCart(cart) {
    if (state.items.length !== state.boxSize || !cart?.items?.some((line) => line.properties?._bundle_id)) {
      return false;
    }

    for (const [variantId, needed] of variantCounts()) {
      if (cartQuantity(cart, variantId) < needed) return false;
    }

    return true;
  }

  async function fetchCart() {
    const response = await fetch(`${window.Shopify.routes.root}cart.js`);
    if (!response.ok) throw new Error("Unable to read your cart. Please try again.");
    return response.json();
  }

  async function clearIfAlreadyInCart() {
    try {
      const cart = await fetchCart();
      if (!boxAlreadyInCart(cart)) return false;

      state.items = [];
      saveState();
      updateSummary();
      showToast(
        "This box is already in your cart. Open Cart to checkout, or remove the box there to start a new one.",
        "info"
      );
      return true;
    } catch (error) {
      console.error("Could not sync builder with cart:", error);
      return false;
    }
  }

  function cartValidation(cart) {
    if (state.items.length !== state.boxSize) {
      if (state.items.length > state.boxSize) {
        return `You have ${state.items.length} items but this box holds ${state.boxSize}. Remove the extra item(s) in Your Box, then try again.`;
      }

      return `Add ${state.boxSize - state.items.length} more item(s) to complete your box.`;
    }

    for (const [variantId, quantity] of variantCounts()) {
      const sample = state.items.find((item) => String(item.variantId) === variantId);
      const limit = stockLimit(sample.id, variantId);
      const inCart = cartQuantity(cart, variantId);

      if (limit === 0) {
        return `${sample.title} — ${sample.variantTitle} is sold out. Remove it from your box and try again.`;
      }

      if (limit !== null && inCart + quantity > limit) {
        if (inCart >= limit) {
          return `${sample.title} — ${sample.variantTitle} is already in your cart at the maximum stock allowed. Open Cart and remove that box, or change this selection.`;
        }

        return "Not enough stock for one or more items in your box (including what is already in your cart). Adjust your box or cart and try again.";
      }
    }

    return "";
  }

  function cartLines() {
    const bundleId = crypto.randomUUID();
    const lines = new Map();

    state.items.forEach((item) => {
      const key = String(item.variantId);

      if (!lines.has(key)) {
        lines.set(key, {
          id: Number(item.variantId),
          quantity: 0,
          properties: {
            _bundle_id: bundleId,
            _bundle_size: String(state.boxSize)
          }
        });
      }

      lines.get(key).quantity += 1;
    });

    return Array.from(lines.values());
  }

  async function addBundleToCart() {
    if (isAddingToCart) return;

    isAddingToCart = true;
    addButton.disabled = true;
    addButton.textContent = "Adding to Cart...";

    try {
      const cart = await fetchCart();

      if (boxAlreadyInCart(cart)) {
        state.items = [];
        saveState();
        window.location.href = `${window.Shopify.routes.root}cart`;
        return;
      }

      const errorMessage = cartValidation(cart);
      if (errorMessage) throw new Error(errorMessage);

      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ items: cartLines() })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.description || result.message || "Unable to add your box to the cart.");
      }

      state.items = [];
      saveState();
      window.location.href = `${window.Shopify.routes.root}cart`;
    } catch (error) {
      console.error("Add to cart failed:", error);
      showToast(error.message || "Something went wrong. Please try again.", "error");
    } finally {
      isAddingToCart = false;
      addButton.textContent = "Add Box to Cart";
      addButton.disabled = state.items.length !== state.boxSize;
    }
  }

  function renderProducts(products) {
    const handle = container.dataset.collectionHandle?.trim();

    if (!products.length) {
      productsContainer.textContent = handle
        ? `The collection “${handle}” has no products. In Admin, open that collection, add active products, and publish them to Online Store.`
        : NO_COLLECTION_MESSAGE;
      return;
    }

    productsContainer.replaceChildren();

    products.forEach((product) => {
      const card = document.createElement("article");
      card.className = "box-builder__card";
      const title = document.createElement("h3");
      const priceEl = document.createElement("p");
      const variantSelect = document.createElement("select");
      const button = document.createElement("button");
      const firstAvailable = product.variants.find((variant) => variant.available);

      product.variants.forEach((variant) => {
        const option = document.createElement("option");
        option.value = variant.id;
        option.textContent = variant.title;
        option.disabled = !variant.available;
        variantSelect.append(option);
      });

      if (firstAvailable) {
        variantSelect.value = String(firstAvailable.id);
      } else {
        variantSelect.disabled = true;
      }

      title.textContent = product.title;
      priceEl.className = "box-builder__card-price";

      function selectedVariant() {
        return product.variants.find(
          (item) => String(item.id) === String(variantSelect.value)
        );
      }

      function syncCardPrice() {
        const variant = selectedVariant();
        priceEl.textContent = variant ? formatPrice(variant.price) : "—";
      }

      syncCardPrice();
      variantSelect.addEventListener("change", syncCardPrice);

      if (product.images?.[0]?.src) {
        const image = document.createElement("img");
        image.src = product.images[0].src;
        image.alt = product.title;
        image.width = 200;
        image.loading = "lazy";
        card.append(image);
      }

      button.type = "button";
      button.textContent = "Add to Box";
      button.disabled = !firstAvailable;
      button.addEventListener("click", () => {
        const variant = selectedVariant();

        if (!variant?.available) {
          showToast("Please select an available variant.", "error");
          return;
        }

        addProduct(selectionItem(product, variant));
      });

      card.append(title, priceEl, variantSelect, button);
      productsContainer.append(card);
    });
  }

  function normalizeProducts(rawProducts) {
    if (!Array.isArray(rawProducts)) return [];

    return rawProducts.map((product) => ({
      id: product.id,
      title: product.title,
      variants: (product.variants || []).map((variant) => ({
        id: variant.id,
        title: variant.title,
        available: Boolean(variant.available),
        price: toMinorUnits(variant.price),
        compare_at_price: toMinorUnits(variant.compare_at_price)
      })),
      images: (product.images || [])
        .map((image) => {
          if (typeof image === "string") return { src: image };
          if (image?.src) return { src: image.src };
          return null;
        })
        .filter(Boolean)
    }));
  }

  async function loadProducts() {
    const handle = container.dataset.collectionHandle?.trim();
    productsContainer.textContent = "Loading products...";

    if (!handle) {
      productsContainer.textContent = NO_COLLECTION_MESSAGE;
      return;
    }

    const url = `${window.Shopify.routes.root}collections/${encodeURIComponent(handle)}/products.json?limit=250`;
    let response;

    try {
      response = await fetch(url);
    } catch (error) {
      productsContainer.textContent = "Network error while loading products. Check your connection and refresh.";
      console.error(error);
      return;
    }

    if (!response.ok) {
      productsContainer.textContent = `Could not load products (HTTP ${response.status}). Confirm collection “${handle}” exists and is available on the Online Store channel.`;
      return;
    }

    let data;

    try {
      data = await response.json();
    } catch (error) {
      productsContainer.textContent = "Received an invalid response from the store. Please refresh and try again.";
      console.error(error);
      return;
    }

    const products = normalizeProducts(data.products);
    restoreState(products);
    renderProducts(products);
    await clearIfAlreadyInCart();
  }

  addButton.textContent = "Add Box to Cart";
  addButton.addEventListener("click", addBundleToCart);

  loadProducts().finally(() => {
    container.querySelectorAll("[data-box-size]").forEach((button) => {
      button.addEventListener("click", () => selectBoxSize(Number(button.dataset.boxSize), true));
    });

    selectBoxSize(state.boxSize);
  });
}

document.addEventListener("DOMContentLoaded", initializeBoxBuilder);

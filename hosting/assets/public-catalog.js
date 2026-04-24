(function () {
  const metaNode = document.getElementById("catalogMeta");
  if (!metaNode) return;

  const metadata = JSON.parse(metaNode.textContent || "{}");
  const queueKey = `catalog-offline-queue:${metadata.slug || "catalog"}`;
  const visitorId = stableClientId("catalog-visitor-id", "visitor");
  const sessionId = stableSessionId();
  let searchTrackTimer = null;
  const state = {
    products: [],
    filtered: [],
    cart: new Map(),
    activeProduct: null,
    activeMediaIndex: 0,
    publicContext: null,
    isOffline: !navigator.onLine,
    filters: { search: "", category: "Todos" }
  };

  const els = {
    brandTitle: byId("catalogBrandTitle"),
    brandSubtitle: byId("catalogBrandSubtitle"),
    sellerRef: byId("sellerReference"),
    clientRef: byId("clientReference"),
    heroCard: document.querySelector(".hero-card"),
    heroTitle: byId("heroTitle"),
    heroSubtitle: byId("heroSubtitle"),
    promoBlock: byId("promoBlock"),
    promoTitle: byId("promoTitle"),
    promoText: byId("promoText"),
    promoMedia: byId("promoMedia"),
    promoActions: byId("promoActions"),
    categoryFilters: byId("categoryFilters"),
    resultCount: byId("resultCount"),
    productGrid: byId("productGrid"),
    cartButton: byId("cartButton"),
    cartBadge: byId("cartBadge"),
    cartDrawer: byId("cartDrawer"),
    cartDrawerBackdrop: byId("cartDrawerBackdrop"),
    cartClose: byId("cartClose"),
    cartLines: byId("cartLines"),
    cartSummary: byId("cartSummary"),
    continueShopping: byId("continueShoppingButton"),
    checkoutForm: byId("checkoutForm"),
    checkoutStatus: byId("checkoutStatus"),
    searchInput: byId("catalogSearch"),
    detailOverlay: byId("detailOverlay"),
    detailClose: byId("detailClose"),
    detailTitle: byId("detailTitle"),
    detailSubtitle: byId("detailSubtitle"),
    detailStage: byId("detailStage"),
    detailThumbs: byId("detailThumbs"),
    detailSpecs: byId("detailSpecs"),
    calcQty: byId("calcQty"),
    calcMinus: byId("calcMinus"),
    calcPlus: byId("calcPlus"),
    calcAdd: byId("calcAdd"),
    calcBreakdown: byId("calcBreakdown"),
    expiredOverlay: byId("expiredOverlay"),
    networkBanner: byId("networkBanner"),
    queueIndicator: byId("queueIndicator"),
    exportsPanel: byId("exportsPanel")
  };

  init();

  async function init() {
    applyTheme(metadata.theme);
    document.body.classList.add("catalog-locked");
    document.querySelector(".catalog-shell")?.setAttribute("hidden", "");
    hydrateHeader();
    bindEvents();
    updateOfflineUi();
    const hasAccess = await loadPublicContext();
    if (!hasAccess) {
      lockCatalog();
      return;
    }
    document.body.classList.remove("catalog-locked");
    document.querySelector(".catalog-shell")?.removeAttribute("hidden");
    hydratePromotion();
    hydrateExports();
    renderFilters();
    applyFilters();
    renderCart();
    trackCatalogEvent("catalog_view");
    flushOfflineQueue();
  }

  function hydrateHeader() {
    const logo = byId("catalogLogo");
    const coverLogo = metadata.logoUrl || metadata.coverImage || "";
    if (logo && coverLogo) {
      logo.src = coverLogo;
      logo.hidden = false;
      logo.onerror = () => {
        logo.hidden = true;
      };
    } else if (logo) {
      logo.hidden = true;
    }
    if (els.brandTitle) els.brandTitle.textContent = metadata.title || "Catalogo comercial";
    if (els.brandSubtitle) els.brandSubtitle.textContent = metadata.footerText || "Experiencia mayorista B2B";
    if (els.heroTitle) els.heroTitle.textContent = metadata.heroTitle || metadata.title || "Catalogo comercial";
    if (els.heroSubtitle) els.heroSubtitle.textContent = metadata.heroSubtitle || "Compra mayorista con pedidos trazables y exportables.";
    applyHeroBackground(metadata.heroImage || metadata.hero_image || "");
  }

  function applyHeroBackground(imageUrl) {
    if (!els.heroCard || !imageUrl) return;
    els.heroCard.style.backgroundImage = `linear-gradient(132deg, rgba(0,0,0,.66), rgba(0,0,0,.36)), url("${cssUrlEscape(imageUrl)}")`;
  }

  function hydratePromotion() {
    if (!els.promoBlock) return;
    const promotion = metadata.promotion || {};
    const hasPromo = Boolean(promotion.title || promotion.text || promotion.imageUrl || promotion.image_url || promotion.videoUrl || promotion.video_url);
    if (!hasPromo) {
      els.promoBlock.hidden = true;
      return;
    }

    const imageUrl = promotion.imageUrl || promotion.image_url || "";
    const videoUrl = promotion.videoUrl || promotion.video_url || "";
    const linkUrl = promotion.linkUrl || promotion.link_url || "";
    const linkLabel = promotion.linkLabel || promotion.link_label || "Ver promocion";

    if (els.promoTitle) els.promoTitle.textContent = promotion.title || "Promocion comercial";
    if (els.promoText) els.promoText.textContent = promotion.text || "Consulta esta novedad con tu asesor comercial.";
    if (els.promoMedia) {
      if (videoUrl) {
        els.promoMedia.innerHTML = `
          <video controls playsinline preload="metadata" poster="${escapeHtml(imageUrl)}">
            <source src="${escapeHtml(videoUrl)}">
          </video>
          ${imageUrl ? `<img class="promo-fallback" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(promotion.title || "Promocion")}">` : ""}
        `;
      } else if (imageUrl) {
        els.promoMedia.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(promotion.title || "Promocion")}">`;
      } else {
        els.promoMedia.innerHTML = `<div class="promo-placeholder">Espacio promocional configurable</div>`;
      }
    }
    if (els.promoActions) {
      els.promoActions.innerHTML = [
        linkUrl ? `<a class="button-primary promo-cta" href="${escapeHtml(linkUrl)}" target="_blank" rel="noreferrer">${escapeHtml(linkLabel)}</a>` : "",
        metadata.legacyPdfUrl ? `<a class="button-secondary promo-cta" href="${escapeHtml(metadata.legacyPdfUrl)}" target="_blank" rel="noreferrer">PDF legado</a>` : "",
        metadata.modernPdfUrl ? `<a class="button-secondary promo-cta" href="${escapeHtml(metadata.modernPdfUrl)}" target="_blank" rel="noreferrer">PDF moderno</a>` : ""
      ].filter(Boolean).join("");
    }
  }

  function hydrateExports() {
    if (!els.exportsPanel) return;
    const links = [
      metadata.legacyPdfUrl ? `<a class="catalog-chip catalog-chip--link" href="${escapeHtml(metadata.legacyPdfUrl)}" target="_blank" rel="noreferrer">Catalogo PDF legado</a>` : "",
      metadata.modernPdfUrl ? `<a class="catalog-chip catalog-chip--link" href="${escapeHtml(metadata.modernPdfUrl)}" target="_blank" rel="noreferrer">Catalogo PDF moderno</a>` : ""
    ].filter(Boolean);
    if (!links.length) {
      els.exportsPanel.hidden = true;
      return;
    }
    els.exportsPanel.innerHTML = links.join("");
  }

  async function loadPublicContext() {
    const apiBaseUrl = sanitizeBaseUrl(metadata.apiBaseUrl);
    const token = getShareToken();
    if (!apiBaseUrl || !metadata.slug) return false;

    try {
      const response = await fetch(`${apiBaseUrl}/public_catalog.php?slug=${encodeURIComponent(metadata.slug)}&token=${encodeURIComponent(token)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const error = new Error(result && result.error ? result.error : "No fue posible validar el catalogo.");
        error.status = response.status;
        error.payload = result;
        throw error;
      }

      state.publicContext = result.catalog;
      if (els.sellerRef) els.sellerRef.textContent = `Vendedor: ${result.catalog.seller && result.catalog.seller.name ? result.catalog.seller.name : "Asignacion general"}`;
      if (els.clientRef) els.clientRef.textContent = `Cliente: ${result.catalog.client && result.catalog.client.name ? result.catalog.client.name : "Acceso libre"}`;
      if (result.catalog.metadata && Array.isArray(result.catalog.metadata.catalog)) {
        Object.assign(metadata, result.catalog.metadata);
        state.products = result.catalog.metadata.catalog;
        hydrateHeader();
        applyHeroBackground(metadata.heroImage || metadata.hero_image || "");
      }
      if (result.catalog.metadata && result.catalog.metadata.theme) {
        applyTheme(result.catalog.metadata.theme);
      }
      if (result.catalog.promotion) {
        metadata.promotion = normalizePromotion(result.catalog.promotion);
        hydratePromotion();
      }
      metadata.legacyPdfUrl = result.catalog.legacy_pdf_url || metadata.legacyPdfUrl || "";
      metadata.modernPdfUrl = result.catalog.modern_pdf_url || metadata.modernPdfUrl || "";
      return true;
    } catch (error) {
      lockCatalog(error.message || "Este catalogo requiere un enlace seguro vigente.");
      return false;
    }
  }

  function applyTheme(theme) {
    const primary = sanitizeHexColor(theme && theme.primaryColor);
    const secondary = sanitizeHexColor(theme && theme.secondaryColor);
    const root = document.documentElement;
    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--accent", primary);
      root.style.setProperty("--primary-rgb", hexToRgbString(primary));
    }
    if (secondary) {
      root.style.setProperty("--primary-strong", secondary);
      root.style.setProperty("--accent-strong", secondary);
      root.style.setProperty("--text", secondary);
      root.style.setProperty("--primary-strong-rgb", hexToRgbString(secondary));
    }
  }

  function hexToRgbString(hex) {
    const normalized = sanitizeHexColor(hex);
    if (!normalized) return "";
    const value = normalized.slice(1);
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ].join(", ");
  }

  function lockCatalog(message) {
    document.body.classList.add("catalog-locked");
    document.querySelector(".catalog-shell")?.setAttribute("hidden", "");
    state.products = [];
    state.filtered = [];
    state.cart.clear();
    renderProducts();
    renderCart();
    if (els.expiredOverlay) {
      const text = els.expiredOverlay.querySelector("p");
      if (text && message) text.textContent = message;
      els.expiredOverlay.classList.add("open");
    }
    if (els.checkoutStatus) els.checkoutStatus.textContent = message || "Catalogo no disponible.";
    const submit = byId("checkoutButton");
    if (submit) submit.disabled = true;
  }

  function bindEvents() {
    els.searchInput?.addEventListener("input", () => {
      state.filters.search = els.searchInput.value.trim().toLowerCase();
      applyFilters();
      scheduleSearchTracking(state.filters.search);
    });
    els.detailClose?.addEventListener("click", closeDetail);
    els.detailOverlay?.addEventListener("click", (event) => {
      if (event.target === els.detailOverlay) closeDetail();
    });
    els.calcMinus?.addEventListener("click", () => adjustCalcQty(-getMultipleQty(state.activeProduct)));
    els.calcPlus?.addEventListener("click", () => adjustCalcQty(getMultipleQty(state.activeProduct)));
    els.calcQty?.addEventListener("input", updateCalculator);
    els.calcAdd?.addEventListener("click", () => {
      if (state.activeProduct) addToCart(state.activeProduct, Math.max(1, Number(els.calcQty.value) || 1));
    });
    els.cartButton?.addEventListener("click", openCartDrawer);
    els.cartClose?.addEventListener("click", closeCartDrawer);
    els.cartDrawerBackdrop?.addEventListener("click", closeCartDrawer);
    els.continueShopping?.addEventListener("click", closeCartDrawer);
    els.checkoutForm?.addEventListener("submit", submitOrder);
    window.addEventListener("online", () => {
      state.isOffline = false;
      updateOfflineUi();
      flushOfflineQueue();
    });
    window.addEventListener("offline", () => {
      state.isOffline = true;
      updateOfflineUi();
    });
  }

  function getProductCategory(product) {
    return product.category || product.categoria || product.brand || "General";
  }

  function renderFilters() {
    if (!els.categoryFilters) return;
    const categories = ["Todos", ...new Set(state.products.map(getProductCategory))];
    els.categoryFilters.innerHTML = "";
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;
      if (category === state.filters.category) button.classList.add("active");
      button.addEventListener("click", () => {
        state.filters.category = category;
        renderFilters();
        applyFilters();
        trackCatalogEvent("category_filter", {
          metadata: { category }
        });
      });
      els.categoryFilters.appendChild(button);
    });
  }

  function applyFilters() {
    const search = state.filters.search;
    state.filtered = state.products.filter((product) => {
      const matchesCategory = state.filters.category === "Todos" || getProductCategory(product) === state.filters.category;
      const haystack = [
        product.item,
        product.description,
        product.shortDescription,
        product.brand,
        product.category,
        product.material
      ].join(" ").toLowerCase();
      return matchesCategory && (!search || haystack.includes(search));
    });
    renderProducts();
  }

  function renderProducts() {
    if (!els.productGrid) return;
    els.productGrid.innerHTML = "";
    if (els.resultCount) els.resultCount.textContent = `${state.filtered.length} productos visibles`;

    state.filtered.forEach((product) => {
      const card = document.createElement("article");
      const gallery = buildGallery(product);
      const mainImage = gallery[0] || "";
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-card__media">
          ${mainImage ? `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.description || product.item)}">` : `<div class="product-card__empty">Sin imagen</div>`}
          <span class="product-card__count">${gallery.length > 1 ? `${gallery.length} vistas` : "Detalle"}</span>
        </div>
        <div class="product-card__body">
          <div class="sku">${escapeHtml(product.item || "SKU")}</div>
          <h3>${escapeHtml(product.description || product.shortDescription || product.item || "Producto")}</h3>
          <div class="product-card__meta">
            <div><span>Categoria</span><strong>${escapeHtml(getProductCategory(product))}</strong></div>
            <div><span>Empaque</span><strong>${escapeHtml(product.packageLabel || product.package || product.empaque || "Unidad")}</strong></div>
            <div><span>Venta</span><strong>${escapeHtml(product.saleUnit || product.um || "unidad")}</strong></div>
            <div><span>Minimo</span><strong>${escapeHtml(String(getMinimumQty(product)))}</strong></div>
          </div>
          <div class="product-card__footer">
            <div class="product-card__price">${escapeHtml(formatMoney(parsePrice(product.price)))}</div>
            <div class="product-card__actions">
              <button class="button-secondary" type="button">Ver detalle</button>
              <button class="button-primary" type="button">Agregar</button>
            </div>
          </div>
        </div>
      `;
      const [detailButton, addButton] = card.querySelectorAll("button");
      detailButton.addEventListener("click", () => openDetail(product));
      addButton.addEventListener("click", () => addToCart(product, getMinimumQty(product)));
      card.querySelector(".product-card__media")?.addEventListener("click", () => openDetail(product));
      els.productGrid.appendChild(card);
    });
  }

  function buildGallery(product) {
    const media = product.media || {};
    const images = [];
    if (media.mainImage) images.push(media.mainImage);
    if (Array.isArray(media.gallery)) media.gallery.forEach((src) => src && images.push(src));
    return [...new Set(images)];
  }

  function openDetail(product) {
    state.activeProduct = product;
    state.activeMediaIndex = 0;
    if (els.calcQty) els.calcQty.value = String(getMinimumQty(product));
    if (els.detailTitle) els.detailTitle.textContent = product.description || product.item || "Producto";
    if (els.detailSubtitle) {
      els.detailSubtitle.textContent = `${product.item || ""} · ${getProductCategory(product)} · ${formatMoney(parsePrice(product.price))}`;
    }
    renderDetailMedia();
    renderDetailSpecs(product);
    updateCalculator();
    els.detailOverlay?.classList.add("open");
    trackProductEvent("product_detail", product);
  }

  function closeDetail() {
    els.detailOverlay?.classList.remove("open");
  }

  function renderDetailMedia() {
    if (!state.activeProduct || !els.detailStage || !els.detailThumbs) return;
    const gallery = buildGallery(state.activeProduct);
    const video = state.activeProduct.media && state.activeProduct.media.video ? state.activeProduct.media.video : "";
    const items = gallery.map((src) => ({ type: "image", src }));
    if (video) items.push({ type: "video", src: video });
    const active = items[state.activeMediaIndex] || null;

    els.detailStage.innerHTML = active
      ? active.type === "video"
        ? `<video controls playsinline preload="metadata"><source src="${escapeHtml(active.src)}"></video>`
        : `<img src="${escapeHtml(active.src)}" alt="">`
      : `<div class="product-card__empty">Sin multimedia</div>`;

    els.detailThumbs.innerHTML = "";
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === state.activeMediaIndex ? "active" : "";
      button.innerHTML = item.type === "video"
        ? `<span class="thumb-video">Video</span>`
        : `<img src="${escapeHtml(item.src)}" alt="">`;
      button.addEventListener("click", () => {
        state.activeMediaIndex = index;
        renderDetailMedia();
        trackProductEvent("product_media", state.activeProduct, {
          metadata: { media_type: item.type, media_index: index }
        });
      });
      els.detailThumbs.appendChild(button);
    });
  }

  function renderDetailSpecs(product) {
    if (!els.detailSpecs) return;
    const specs = [
      ["SKU", product.item || "-"],
      ["Categoria", getProductCategory(product)],
      ["Marca", product.brand || "-"],
      ["Material", product.material || "-"],
      ["Tamano", product.size || product.measureBadge || "-"],
      ["Disponibilidad", product.available || "-"],
      ["Venta", product.saleUnit || product.um || "unidad"],
      ["Empaque", `${product.packageLabel || product.package || product.empaque || "Unidad"} / ${getPackSize(product)}`],
      ["Minimo", String(getMinimumQty(product))],
      ["Multiplo", String(getMultipleQty(product))]
    ];
    els.detailSpecs.innerHTML = specs.map(([label, value]) => `
      <div class="detail-spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    `).join("");
  }

  function adjustCalcQty(delta) {
    if (!state.activeProduct || !els.calcQty) return;
    const current = Math.max(1, Number(els.calcQty.value) || 1);
    els.calcQty.value = String(Math.max(getMinimumQty(state.activeProduct), current + delta));
    updateCalculator();
  }

  function updateCalculator() {
    if (!state.activeProduct || !els.calcQty || !els.calcBreakdown) return;
    const qty = normalizeQuantity(Number(els.calcQty.value) || getMinimumQty(state.activeProduct), state.activeProduct);
    const packSize = getPackSize(state.activeProduct);
    const totalPieces = qty * packSize;
    const totalAmount = totalPieces * parsePrice(state.activeProduct.price);
    els.calcQty.value = String(qty);
    els.calcBreakdown.innerHTML = `
      <div class="summary-row"><span>Cantidad</span><strong>${qty} ${escapeHtml(state.activeProduct.saleUnit || "bultos")}</strong></div>
      <div class="summary-row"><span>Contenido por empaque</span><strong>${packSize}</strong></div>
      <div class="summary-row"><span>Total piezas</span><strong>${totalPieces}</strong></div>
      <div class="summary-row"><span>Total estimado</span><strong>${formatMoney(totalAmount)}</strong></div>
    `;
  }

  function addToCart(product, quantity) {
    const qty = normalizeQuantity(quantity, product);
    const key = String(product.item || product.description);
    const current = state.cart.get(key);
    if (current) {
      current.quantity += qty;
    } else {
      state.cart.set(key, { key, product, quantity: qty });
    }
    renderCart();
    closeDetail();
    openCartDrawer();
    trackProductEvent("add_to_cart", product, {
      quantity: qty,
      value_amount: qty * getPackSize(product) * parsePrice(product.price)
    });
  }

  function renderCart() {
    const items = Array.from(state.cart.values());
    const cartCount = items.reduce((sum, entry) => sum + entry.quantity, 0);
    if (els.cartButton) els.cartButton.textContent = `Carrito`;
    if (els.cartBadge) els.cartBadge.textContent = String(cartCount);
    if (els.cartLines) {
      els.cartLines.innerHTML = items.length ? "" : `<p class="cart-empty">Todavia no has agregado productos.</p>`;
    }

    let total = 0;
    items.forEach((entry) => {
      const packSize = getPackSize(entry.product);
      const pieces = entry.quantity * packSize;
      const lineTotal = pieces * parsePrice(entry.product.price);
      total += lineTotal;
      const line = document.createElement("article");
      line.className = "cart-line";
      line.innerHTML = `
        <img src="${escapeHtml(buildGallery(entry.product)[0] || "")}" alt="">
        <div>
          <strong>${escapeHtml(entry.product.description || entry.product.item)}</strong>
          <div class="muted">${escapeHtml(entry.product.item || "")}</div>
          <div class="muted">${escapeHtml(entry.product.saleUnit || "unidad")} · ${escapeHtml(entry.product.packageLabel || entry.product.package || "Empaque")}</div>
          <div class="qty-controls">
            <button type="button">-</button>
            <input type="number" min="${getMinimumQty(entry.product)}" value="${entry.quantity}">
            <button type="button">+</button>
            <button type="button">x</button>
          </div>
          <div class="muted">Subtotal: ${formatMoney(lineTotal)}</div>
        </div>
      `;
      const [minus, input, plus, remove] = line.querySelectorAll("button, input");
      minus.addEventListener("click", () => updateCartQty(entry.key, entry.quantity - getMultipleQty(entry.product)));
      plus.addEventListener("click", () => updateCartQty(entry.key, entry.quantity + getMultipleQty(entry.product)));
      input.addEventListener("change", () => updateCartQty(entry.key, Number(input.value) || entry.quantity));
      remove.addEventListener("click", () => {
        state.cart.delete(entry.key);
        renderCart();
        trackProductEvent("remove_from_cart", entry.product);
      });
      els.cartLines?.appendChild(line);
    });

    if (els.cartSummary) {
      els.cartSummary.innerHTML = `
        <div class="summary-row"><span>Cliente</span><strong>${escapeHtml(state.publicContext?.client?.name || "Por definir")}</strong></div>
        <div class="summary-row"><span>Vendedor</span><strong>${escapeHtml(state.publicContext?.seller?.name || "General")}</strong></div>
        <div class="summary-row"><span>Catalogo</span><strong>${escapeHtml(metadata.title || "")}</strong></div>
        <div class="summary-row"><span>Fecha</span><strong>${new Date().toLocaleDateString("es-CO")}</strong></div>
        <div class="summary-row"><span>Total general</span><strong>${formatMoney(total)}</strong></div>
      `;
    }
  }

  function updateCartQty(key, nextQty) {
    const entry = state.cart.get(key);
    if (!entry) return;
    const qty = normalizeQuantity(nextQty, entry.product);
    if (qty <= 0) {
      state.cart.delete(key);
    } else {
      entry.quantity = qty;
    }
    renderCart();
    trackProductEvent("cart_quantity", entry.product, {
      quantity: qty,
      value_amount: qty * getPackSize(entry.product) * parsePrice(entry.product.price)
    });
  }

  async function submitOrder(event, forcedPayload) {
    if (event) event.preventDefault();
    const payload = forcedPayload || buildOrderPayload();
    if (!payload) return;

    const apiBaseUrl = sanitizeBaseUrl(metadata.apiBaseUrl);
    if (!apiBaseUrl || state.isOffline) {
      enqueueOfflineOrder(payload);
      trackCatalogEvent("offline_order_queued", {
        metadata: { item_count: payload.items.length, source_channel: payload.source_channel }
      });
      if (!forcedPayload) {
        state.cart.clear();
        renderCart();
        els.checkoutForm?.reset();
      }
      if (els.checkoutStatus) {
        els.checkoutStatus.textContent = "Pedido guardado localmente. Se reenviara cuando vuelva la conexion.";
      }
      return;
    }

    const submitButton = byId("checkoutButton");
    if (submitButton && !forcedPayload) submitButton.disabled = true;
    if (els.checkoutStatus && !forcedPayload) els.checkoutStatus.textContent = "Enviando pedido...";
    if (!forcedPayload) {
      trackCatalogEvent("order_submit_attempt", {
        metadata: { item_count: payload.items.length, source_channel: payload.source_channel }
      });
    }

    try {
      const response = await fetch(`${apiBaseUrl}/submit_order.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const error = new Error(result && result.error ? result.error : "No se pudo registrar el pedido.");
        error.serverResponse = true;
        error.details = result && result.details ? result.details : "";
        throw error;
      }

      if (!forcedPayload) {
        state.cart.clear();
        renderCart();
        els.checkoutForm?.reset();
        if (els.checkoutStatus) els.checkoutStatus.textContent = `Pedido registrado con numero ${result.order.order_number}.`;
        trackCatalogEvent("order_submit_success", {
          value_amount: result.order.total || 0,
          metadata: { order_number: result.order.order_number, item_count: payload.items.length }
        });
      }
      return result;
    } catch (error) {
      if (forcedPayload) throw error;
      trackCatalogEvent("order_submit_failed", {
        metadata: { message: error.message || "order failed", server: Boolean(error.serverResponse) }
      });
      if (error.serverResponse) {
        if (els.checkoutStatus) {
          els.checkoutStatus.textContent = error.details ? `${error.message}: ${error.details}` : error.message;
        }
        return;
      }
      enqueueOfflineOrder({ ...payload, source_channel: "offline-sync" });
      trackCatalogEvent("offline_order_queued", {
        metadata: { item_count: payload.items.length, reason: "network-fallback" }
      });
      state.cart.clear();
      renderCart();
      els.checkoutForm?.reset();
      if (els.checkoutStatus) {
        els.checkoutStatus.textContent = "No hubo conexion estable. El pedido quedo guardado para reenvio automatico.";
      }
    } finally {
      if (submitButton && !forcedPayload) submitButton.disabled = false;
    }
  }

  function buildOrderPayload() {
    if (!state.cart.size) {
      if (els.checkoutStatus) els.checkoutStatus.textContent = "Agrega al menos un producto al carrito.";
      return null;
    }

    return {
      slug: metadata.slug || "",
      share_token: getShareToken(),
      company_name: byId("companyName")?.value.trim() || "",
      contact_name: byId("contactName")?.value.trim() || "",
      contact_email: byId("contactEmail")?.value.trim() || "",
      contact_phone: byId("contactPhone")?.value.trim() || "",
      address_zone: byId("addressZone")?.value.trim() || "",
      comments: byId("comments")?.value.trim() || "",
      source_channel: state.isOffline ? "offline-sync" : "web",
      items: Array.from(state.cart.values()).map((entry) => {
        const packSize = getPackSize(entry.product);
        return {
          item_code: entry.product.item || "",
          description: entry.product.description || entry.product.item || "",
          quantity: entry.quantity,
          sale_unit: entry.product.saleUnit || entry.product.um || "unidad",
          package_label: entry.product.packageLabel || entry.product.package || entry.product.empaque || "Empaque",
          package_qty: packSize,
          pieces_total: entry.quantity * packSize,
          unit_price: parsePrice(entry.product.price),
          line_total: entry.quantity * packSize * parsePrice(entry.product.price)
        };
      })
    };
  }

  function enqueueOfflineOrder(payload) {
    const queue = readOfflineQueue();
    queue.push({
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      payload
    });
    localStorage.setItem(queueKey, JSON.stringify(queue));
    updateQueueIndicator();
  }

  async function flushOfflineQueue() {
    if (state.isOffline || !sanitizeBaseUrl(metadata.apiBaseUrl)) return;
    const queue = readOfflineQueue();
    if (!queue.length) {
      updateQueueIndicator();
      return;
    }

    const pending = [];
    for (const entry of queue) {
      try {
        await submitOrder(null, { ...entry.payload, source_channel: "offline-sync" });
      } catch (error) {
        pending.push(entry);
      }
    }
    localStorage.setItem(queueKey, JSON.stringify(pending));
    updateQueueIndicator();
  }

  function readOfflineQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(queueKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function updateOfflineUi() {
    if (els.networkBanner) {
      els.networkBanner.hidden = !state.isOffline;
      els.networkBanner.textContent = state.isOffline
        ? "Sin internet. Puedes seguir armando el pedido y lo guardaremos para reenvio."
        : "Conexion restablecida.";
    }
    updateQueueIndicator();
  }

  function updateQueueIndicator() {
    if (!els.queueIndicator) return;
    const queued = readOfflineQueue().length;
    els.queueIndicator.textContent = queued ? `${queued} pedido(s) en cola offline` : "Sin pedidos pendientes";
  }

  function openCartDrawer() {
    els.cartDrawer?.classList.add("open");
    els.cartDrawerBackdrop?.classList.add("open");
    document.body.classList.add("drawer-open");
    trackCatalogEvent("cart_open", {
      metadata: { item_count: state.cart.size }
    });
  }

  function closeCartDrawer() {
    els.cartDrawer?.classList.remove("open");
    els.cartDrawerBackdrop?.classList.remove("open");
    document.body.classList.remove("drawer-open");
  }

  function getPackSize(product) {
    return Math.max(1, Number(product.packageQty || product.packSize || sanitizeNumber(product.package || product.empaque) || 1));
  }

  function getMinimumQty(product) {
    return Math.max(1, Number((product && (product.minimumOrder || product.minQty)) || 1));
  }

  function getMultipleQty(product) {
    return Math.max(1, Number((product && (product.multipleQty || product.multiple)) || 1));
  }

  function normalizeQuantity(quantity, product) {
    const minimum = getMinimumQty(product);
    const multiple = getMultipleQty(product);
    const raw = Math.max(minimum, Number(quantity) || minimum);
    return Math.ceil(raw / multiple) * multiple;
  }

  function getShareToken() {
    return new URLSearchParams(window.location.search).get("token") || "";
  }

  function scheduleSearchTracking(searchTerm) {
    if (searchTrackTimer) window.clearTimeout(searchTrackTimer);
    const normalized = String(searchTerm || "").trim();
    if (normalized.length < 2) return;
    searchTrackTimer = window.setTimeout(() => {
      trackCatalogEvent("search", {
        search_term: normalized,
        metadata: {
          results_count: state.filtered.length,
          category: state.filters.category
        }
      });
    }, 650);
  }

  function trackProductEvent(eventType, product, extra = {}) {
    if (!product) return;
    trackCatalogEvent(eventType, {
      ...extra,
      product: {
        item_code: product.item || "",
        item_name: product.description || product.shortDescription || product.item || "",
        category: getProductCategory(product)
      }
    });
  }

  function trackCatalogEvent(eventType, details = {}) {
    const apiBaseUrl = sanitizeBaseUrl(metadata.apiBaseUrl);
    if (!apiBaseUrl || !metadata.slug || state.isOffline) return;

    const payload = {
      slug: metadata.slug || "",
      share_token: getShareToken(),
      event_type: eventType,
      visitor_id: visitorId,
      session_id: sessionId,
      path: `${window.location.pathname}${window.location.search}`,
      source: "catalog-public",
      ...details
    };
    const url = `${apiBaseUrl}/track_event.php`;

    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    } catch (error) {
    }
  }

  function stableClientId(storageKey, prefix) {
    try {
      const existing = localStorage.getItem(storageKey);
      if (existing) return existing;
      const next = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(storageKey, next);
      return next;
    } catch (error) {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function stableSessionId() {
    try {
      const key = `catalog-session-id:${metadata.slug || "catalog"}`;
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;
      const next = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, next);
      return next;
    } catch (error) {
      return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function sanitizeNumber(value) {
    const normalized = String(value || "").replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
    return Number(normalized) || 0;
  }

  function parsePrice(value) {
    return sanitizeNumber(value);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: metadata.currency || "USD",
      minimumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function sanitizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function sanitizeHexColor(value) {
    const normalized = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : "";
  }

  function normalizePromotion(promotion) {
    return {
      title: promotion.title || "",
      text: promotion.text || "",
      imageUrl: promotion.image_url || promotion.imageUrl || "",
      videoUrl: promotion.video_url || promotion.videoUrl || "",
      linkUrl: promotion.link_url || promotion.linkUrl || "",
      linkLabel: promotion.link_label || promotion.linkLabel || ""
    };
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cssUrlEscape(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
})();

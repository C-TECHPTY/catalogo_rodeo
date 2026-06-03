/**
 * Catálogo Rodeo B2B
 * Nombre actual/provisional del sistema.
 *
 * Autor principal: Nelson Sánchez
 * Año: 2026
 *
 * Sistema desarrollado para generación de catálogos digitales,
 * gestión visual de productos, publicación web y pedidos comerciales.
 *
 * Todos los derechos reservados.
 *
 * Nota:
 * Este encabezado documenta autoría y evolución del sistema.
 * No modifica el funcionamiento del código.
 */

(function () {
  const metaNode = document.getElementById("catalogMeta");
  if (!metaNode) return;

  const metadata = JSON.parse(metaNode.textContent || "{}");
  const DEFAULT_FEATURED_BRANDS = [
    { name: "LUXURY HOME LINENS", slug: "luxury-home-linens" },
    { name: "ACENOX", slug: "acenox" },
    { name: "ROBERT HAMILTON", slug: "robert-hamilton" },
    { name: "MARANELO", slug: "maranelo" },
    { name: "DISCOVERY EXPEDITION", slug: "discovery-expedition" },
    { name: "HOME BLANK", slug: "home-blank" },
    { name: "FINECASA", slug: "finecasa" }
  ];
  const DEFAULT_START_BRAND_SLUGS = ["luxury-home-linens", "luxury-home-liner", "luxury-home", "luxury"];
  const SORT_OPTIONS = [
    { value: "featured", label: "Luxury primero" },
    { value: "item-asc", label: "ITEM A-Z" },
    { value: "description-asc", label: "Descripcion A-Z" }
  ];
  const queueKey = `catalog-offline-queue:${metadata.slug || "catalog"}`;
  const languageKey = `catalog-language:${metadata.slug || "catalog"}`;
  const visitorId = stableClientId("catalog-visitor-id", "visitor");
  const sessionId = stableSessionId();
  let searchTrackTimer = null;
  let promoSliderTimer = null;
  const state = {
    products: [],
    filtered: [],
    cart: new Map(),
    activeProduct: null,
    activeMediaIndex: 0,
    mediaCache: new Map(),
    imageProbeCache: new Map(),
    publicContext: null,
    reviewModal: null,
    reviewStatus: null,
    reviewConfirm: null,
    reviewSubmit: null,
    isOffline: !navigator.onLine,
    currentPage: 1,
    productsPerPage: Number(metadata.productsPerPage || metadata.pageSize || 48) || 48,
    sortMode: "featured",
    filters: { search: "", category: "Todos", brand: "Todas" }
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
    featuredBrandsMount: byId("featuredBrandsMount"),
    resultCount: byId("resultCount"),
    productGrid: byId("productGrid"),
    pagination: null,
    backToTop: null,
    cartButton: byId("cartButton"),
    cartBadge: byId("cartBadge"),
    cartDrawer: byId("cartDrawer"),
    cartDrawerBackdrop: byId("cartDrawerBackdrop"),
    cartClose: byId("cartClose"),
    cartLines: byId("cartLines"),
    cartSummary: byId("cartSummary"),
    continueShopping: byId("continueShoppingButton"),
    checkoutForm: byId("checkoutForm"),
    checkoutButton: byId("checkoutButton"),
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
  let imageZoomOverlay = null;
  let floatingScrollTimer = null;
  let translateScriptLoading = false;

  init();

  async function init() {
    applyTheme(metadata.theme);
    initLanguageSwitcher();
    document.body.classList.add("catalog-locked");
    document.querySelector(".catalog-shell")?.setAttribute("hidden", "");
    hydrateHeader();
    bindEvents();
    if (els.checkoutButton) {
      els.checkoutButton.type = "button";
      els.checkoutButton.textContent = "Revisar pedido";
    }
    updateOfflineUi();
    const hasAccess = await loadPublicContext();
    if (!hasAccess) {
      lockCatalog();
      return;
    }
    document.body.classList.remove("catalog-locked");
    document.querySelector(".catalog-shell")?.removeAttribute("hidden");
    initializeDefaultCatalogView();
    hydrateHeader();
    safeHydratePromotion();
    hydrateExports();
    renderFilters();
    applyFilters();
    renderCart();
    trackCatalogEvent("catalog_view");
    flushOfflineQueue();
    initCatalogGuide();
  }

  function initLanguageSwitcher() {
    const switcher = ensureLanguageSwitcher();
    if (!switcher) return;
    const savedLanguage = normalizeCatalogLanguage(localStorage.getItem(languageKey) || getTranslateCookieLanguage() || "es");
    setLanguageButtonsState(savedLanguage);
    switcher.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-catalog-lang]") : null;
      if (!button) return;
      const language = normalizeCatalogLanguage(button.getAttribute("data-catalog-lang") || "es");
      localStorage.setItem(languageKey, language);
      setLanguageButtonsState(language);
      applyCatalogLanguage(language);
    });
    if (savedLanguage === "en") {
      applyCatalogLanguage(savedLanguage, { silent: true });
    }
  }

  function ensureLanguageSwitcher() {
    const existing = byId("catalogLanguageSwitcher");
    if (existing) return existing;
    const switcher = document.createElement("div");
    switcher.id = "catalogLanguageSwitcher";
    switcher.className = "language-switcher notranslate";
    switcher.setAttribute("aria-label", "Idioma del catalogo");
    switcher.setAttribute("translate", "no");
    switcher.innerHTML = `
      <button type="button" data-catalog-lang="es">ES</button>
      <button type="button" data-catalog-lang="en">EN</button>
    `;
    document.body.prepend(switcher);
    if (!byId("google_translate_element")) {
      const host = document.createElement("div");
      host.id = "google_translate_element";
      host.className = "google-translate-host";
      host.hidden = true;
      document.body.prepend(host);
    }
    return switcher;
  }

  function normalizeCatalogLanguage(value) {
    return String(value || "").toLowerCase() === "en" ? "en" : "es";
  }

  function setLanguageButtonsState(language) {
    document.querySelectorAll("[data-catalog-lang]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-catalog-lang") === language);
    });
  }

  function getTranslateCookieLanguage() {
    const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
    const value = match ? decodeURIComponent(match[1]) : "";
    return value.endsWith("/en") ? "en" : "es";
  }

  function applyCatalogLanguage(language, options = {}) {
    setTranslateCookie(language);
    if (language === "es") {
      const combo = document.querySelector(".goog-te-combo");
      if (combo) {
        combo.value = "es";
        combo.dispatchEvent(new Event("change"));
      } else if (!options.silent) {
        window.location.reload();
      }
      return;
    }
    loadGoogleTranslate(() => {
      const combo = document.querySelector(".goog-te-combo");
      if (!combo) {
        if (!options.silent) window.location.reload();
        return;
      }
      combo.value = "en";
      combo.dispatchEvent(new Event("change"));
    });
  }

  function setTranslateCookie(language) {
    const value = language === "en" ? "/es/en" : "/es/es";
    const expires = language === "en" ? ";max-age=31536000" : ";max-age=0";
    const hostParts = window.location.hostname.split(".");
    document.cookie = `googtrans=${value};path=/${expires}`;
    if (hostParts.length > 1) {
      document.cookie = `googtrans=${value};path=/;domain=.${hostParts.slice(-2).join(".")}${expires}`;
    }
  }

  function loadGoogleTranslate(callback) {
    window.googleTranslateElementInit = function () {
      try {
        new window.google.translate.TranslateElement({
          pageLanguage: "es",
          includedLanguages: "es,en",
          autoDisplay: false
        }, "google_translate_element");
      } catch (error) {
        console.warn("No se pudo inicializar el traductor.", error);
      }
      window.setTimeout(callback, 500);
    };
    if (window.google?.translate?.TranslateElement) {
      window.googleTranslateElementInit();
      return;
    }
    if (translateScriptLoading) {
      window.setTimeout(callback, 900);
      return;
    }
    translateScriptLoading = true;
    const script = document.createElement("script");
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    script.onerror = () => {
      translateScriptLoading = false;
      console.warn("No se pudo cargar Google Translate.");
    };
    document.head.appendChild(script);
  }

  function hydrateHeader() {
    applyActiveBrandTheme();
    const brandTemplate = getCurrentBrandTemplate();
    const activeBrandName = getActiveBrandName();
    const scopedTitle = brandTemplate?.bannerTitle || activeBrandName || metadata.title || "Catalogo comercial";
    const logo = byId("catalogLogo");
    const coverLogo = brandTemplate?.logo || metadata.logoUrl || metadata.coverImage || "./assets/img/logo-rodeo-azul.png";
    if (logo && coverLogo) {
      logo.src = coverLogo;
      logo.loading = "eager";
      logo.decoding = "async";
      logo.hidden = false;
      logo.onerror = () => {
        logo.hidden = true;
      };
    } else if (logo) {
      logo.hidden = true;
    }
    if (els.brandTitle) els.brandTitle.textContent = scopedTitle;
    if (els.brandSubtitle) els.brandSubtitle.textContent = metadata.footerText ?? "Experiencia mayorista B2B";
    if (els.heroTitle) els.heroTitle.textContent = scopedTitle;
    if (els.heroSubtitle) els.heroSubtitle.textContent = brandTemplate?.promoText || metadata.heroSubtitle || "Compra mayorista con pedidos trazables y exportables.";
    applyHeroBackground(brandTemplate?.banner || brandTemplate?.background || metadata.heroImage || metadata.hero_image || "");
  }

  function applyHeroBackground(imageUrl) {
    if (!els.heroCard) return;
    els.heroCard.style.backgroundImage = imageUrl
      ? `linear-gradient(132deg, rgba(0,0,0,.66), rgba(0,0,0,.36)), url("${cssUrlEscape(imageUrl)}")`
      : "";
  }

  function hydratePromotion() {
    if (!els.promoBlock) return;
    if (promoSliderTimer) {
      window.clearInterval(promoSliderTimer);
      promoSliderTimer = null;
    }
    const brandTemplate = getCurrentBrandTemplate();
    const promotion = metadata.promotion || {};
    const promoImages = normalizePromoImages(promotion, brandTemplate);
    const hasPromo = Boolean(brandTemplate?.promo || brandTemplate?.promoText || promotion.title || promotion.text || promoImages.length || promotion.videoUrl || promotion.video_url);
    if (!hasPromo) {
      els.promoBlock.hidden = true;
      return;
    }
    els.promoBlock.hidden = false;

    const videoUrl = promotion.videoUrl || promotion.video_url || "";
    const linkUrl = promotion.linkUrl || promotion.link_url || "";
    const linkLabel = promotion.linkLabel || promotion.link_label || "Ver promocion";
    const slideInterval = normalizePromoSlideInterval(promotion.slideInterval || promotion.slide_interval);

    if (els.promoTitle) els.promoTitle.textContent = promotion.title || brandTemplate?.bannerTitle || "Promocion comercial";
    if (els.promoText) els.promoText.textContent = brandTemplate?.promoText || promotion.text || "Consulta esta novedad con tu asesor comercial.";
    if (els.promoMedia) {
      if (videoUrl) {
        els.promoMedia.innerHTML = `
          <video controls playsinline preload="metadata" poster="${escapeHtml(promoImages[0] || "")}">
            <source src="${escapeHtml(videoUrl)}">
          </video>
          ${promoImages[0] ? `<img class="promo-fallback" src="${escapeHtml(promoImages[0])}" alt="${escapeHtml(promotion.title || "Promocion")}" loading="lazy" decoding="async">` : ""}
        `;
      } else if (promoImages.length > 1) {
        els.promoMedia.innerHTML = `
          <div class="promo-slider" data-interval="${slideInterval}">
            ${promoImages.map((imageUrl, index) => `<img class="promo-slide${index === 0 ? " is-active" : ""}" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(promotion.title || "Promocion")}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async">`).join("")}
          </div>
          <div class="promo-slider__dots">${promoImages.map((_, index) => `<span class="${index === 0 ? "is-active" : ""}"></span>`).join("")}</div>
        `;
        startPromoSlider(els.promoMedia, slideInterval);
      } else if (promoImages[0]) {
        els.promoMedia.innerHTML = `<img src="${escapeHtml(promoImages[0])}" alt="${escapeHtml(promotion.title || "Promocion")}" loading="lazy" decoding="async">`;
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

  function normalizePromoImages(promotion, brandTemplate) {
    const sliderImages = [
      ...(Array.isArray(promotion.images) ? promotion.images : []),
      ...(Array.isArray(promotion.promoImages) ? promotion.promoImages : []),
      ...(Array.isArray(promotion.imageUrls) ? promotion.imageUrls : []),
      ...(Array.isArray(promotion.image_urls) ? promotion.image_urls : [])
    ].filter(Boolean);
    if (sliderImages.length) return dedupeStringsLocal(sliderImages);
    return dedupeStringsLocal([
      brandTemplate?.promo,
      promotion.imageUrl || promotion.image_url
    ].filter(Boolean));
  }

  function dedupeStringsLocal(values) {
    const seen = new Set();
    return (values || []).filter((value) => {
      const text = String(value || "").trim();
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    });
  }

  function dedupeStrings(values) {
    return dedupeStringsLocal(values);
  }

  function normalizePromoSlideInterval(value) {
    const interval = Number(value);
    return [3000, 5000, 8000, 15000].includes(interval) ? interval : 15000;
  }

  function startPromoSlider(container, interval) {
    const slides = Array.from(container.querySelectorAll(".promo-slide"));
    const dots = Array.from(container.querySelectorAll(".promo-slider__dots span"));
    if (slides.length < 2) return;
    let activeIndex = 0;
    promoSliderTimer = window.setInterval(() => {
      slides[activeIndex]?.classList.remove("is-active");
      dots[activeIndex]?.classList.remove("is-active");
      activeIndex = (activeIndex + 1) % slides.length;
      slides[activeIndex]?.classList.add("is-active");
      dots[activeIndex]?.classList.add("is-active");
    }, interval);
  }

  function safeHydratePromotion() {
    try {
      hydratePromotion();
    } catch (error) {
      console.error("No se pudo cargar la promocion visual.", error);
      if (promoSliderTimer) {
        window.clearInterval(promoSliderTimer);
        promoSliderTimer = null;
      }
      if (els.promoBlock) els.promoBlock.hidden = true;
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
    if (metadata.localPreview === true && Array.isArray(metadata.catalog)) {
      state.products = prepareCatalogProducts(metadata.catalog);
      state.publicContext = {
        seller: { name: "Vista local" },
        client: { name: "Previsualizacion" }
      };
      if (els.sellerRef) els.sellerRef.textContent = "Vista local";
      if (els.clientRef) els.clientRef.textContent = "Cliente: previsualizacion";
      hydrateHeader();
      applyHeroBackground(metadata.heroImage || metadata.hero_image || "");
      return true;
    }
    if (!apiBaseUrl || !metadata.slug) return false;

    try {
      const sellerToken = getSellerToken();
      const response = await fetch(`${apiBaseUrl}/public_catalog.php?slug=${encodeURIComponent(metadata.slug)}&token=${encodeURIComponent(token)}&t=${encodeURIComponent(sellerToken)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const error = new Error(result && result.error ? result.error : "No fue posible validar el catalogo.");
        error.status = response.status;
        error.payload = result;
        throw error;
      }

      state.publicContext = result.catalog;
      if (result.catalog.seller && result.catalog.seller.token) {
        persistSellerToken(result.catalog.seller.token);
      }
      if (els.sellerRef) els.sellerRef.textContent = `Atendido por: ${result.catalog.seller && result.catalog.seller.name ? result.catalog.seller.name : "Asignacion general"}`;
      if (els.clientRef) els.clientRef.textContent = `Cliente: ${result.catalog.client && result.catalog.client.name ? result.catalog.client.name : "Acceso libre"}`;
      if (result.catalog.metadata && Array.isArray(result.catalog.metadata.catalog)) {
        Object.assign(metadata, result.catalog.metadata);
        state.products = prepareCatalogProducts(result.catalog.metadata.catalog);
        applyProductViewCounts(result.catalog.product_view_counts || {});
        hydrateHeader();
        applyHeroBackground(metadata.heroImage || metadata.hero_image || "");
      }
      if (result.catalog.metadata && result.catalog.metadata.theme) {
        applyTheme(result.catalog.metadata.theme);
      }
      if (result.catalog.promotion) {
        metadata.promotion = mergePromotionMetadata(metadata.promotion, result.catalog.promotion);
        safeHydratePromotion();
      }
      metadata.legacyPdfUrl = result.catalog.legacy_pdf_url || metadata.legacyPdfUrl || "";
      metadata.modernPdfUrl = result.catalog.modern_pdf_url || metadata.modernPdfUrl || "";
      return true;
    } catch (error) {
      lockCatalog(error.message || "Este catalogo requiere un enlace seguro vigente.");
      return false;
    }
  }

  function prepareCatalogProducts(products) {
    return (Array.isArray(products) ? products : []).map((product, index) => ({
      ...product,
      __catalogIndex: Number.isFinite(Number(product?.__catalogIndex)) ? Number(product.__catalogIndex) : index
    }));
  }

  function initializeDefaultCatalogView() {
    const brands = getAvailableFilterBrands();
    const initialBrand = resolveInitialCompleteCatalogBrand(brands);
    if (initialBrand) {
      state.filters.brand = initialBrand;
      state.currentPage = 1;
    }
  }

  function resolveInitialCompleteCatalogBrand(brands) {
    if (isEntryScopedCatalog()) return "";
    if (!isCompleteCatalogMode()) return "";
    if (!shouldShowBrandFilter(brands)) return "";
    if (state.filters.brand && state.filters.brand !== "Todas") return "";
    const configured = normalizeBrandSlug(metadata.initialBrandFilter || metadata.startBrandFilter || "");
    const preferredSlugs = configured ? [configured, ...DEFAULT_START_BRAND_SLUGS] : DEFAULT_START_BRAND_SLUGS;
    return findBrandByPreferredSlugs(brands, preferredSlugs);
  }

  function isCompleteCatalogMode() {
    return !metadata.brandExportMode || metadata.brandExportMode === "complete";
  }

  function isEntryScopedCatalog() {
    return metadata.entryScopedCatalog === true || Boolean(String(metadata.entryFilter || "").trim());
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
    const textColor = sanitizeHexColor(theme && theme.textColor);
    if (textColor) {
      root.style.setProperty("--brand-on-primary", textColor);
    }
  }

  function applyActiveBrandTheme() {
    applyTheme(metadata.theme || {});
    if (isCompleteCatalogMode()) return;
    const brandTemplate = getCurrentBrandTemplate();
    if (!brandTemplate) return;
    applyTheme({
      primaryColor: brandTemplate.primaryColor,
      secondaryColor: brandTemplate.secondaryColor,
      textColor: brandTemplate.textColor
    });
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
      state.currentPage = 1;
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
    els.checkoutForm?.addEventListener("submit", openOrderReview);
    els.checkoutButton?.addEventListener("click", openOrderReview);
    window.addEventListener("online", () => {
      state.isOffline = false;
      updateOfflineUi();
      flushOfflineQueue();
    });
    window.addEventListener("offline", () => {
      state.isOffline = true;
      updateOfflineUi();
    });
    window.addEventListener("scroll", updateFloatingActions, { passive: true });
    window.addEventListener("resize", updateFloatingActions);
  }

  function getProductCategory(product) {
    return product.smartCategory || product.smart_category || product.category || product.categoria || product.brand || "General";
  }

  function getProductBrand(product) {
    return String(product.brand || product.marca || "").trim();
  }

  function getProductDescription(product) {
    return String(product.description || product.shortDescription || product.descripcion || product.item || "").trim();
  }

  function normalizeBrandSlug(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function findBrandByPreferredSlugs(brands, preferredSlugs) {
    const available = (brands || [])
      .map((brand) => ({ name: brand, slug: normalizeBrandSlug(brand) }))
      .filter((brand) => brand.name && brand.slug);
    for (const preferredSlug of preferredSlugs || []) {
      const normalizedPreferred = normalizeBrandSlug(preferredSlug);
      if (!normalizedPreferred) continue;
      const exact = available.find((brand) => brand.slug === normalizedPreferred);
      if (exact) return exact.name;
      const partial = available.find((brand) => brand.slug.includes(normalizedPreferred) || normalizedPreferred.includes(brand.slug));
      if (partial) return partial.name;
    }
    return "";
  }

  function getBrandPriority(brand) {
    const slug = normalizeBrandSlug(brand);
    const index = DEFAULT_START_BRAND_SLUGS.findIndex((preferredSlug) => {
      const normalizedPreferred = normalizeBrandSlug(preferredSlug);
      return slug === normalizedPreferred || slug.includes(normalizedPreferred) || normalizedPreferred.includes(slug);
    });
    return index === -1 ? DEFAULT_START_BRAND_SLUGS.length : index;
  }

  function getBrandTemplates() {
    const source = metadata.brandTemplates && typeof metadata.brandTemplates === "object" ? metadata.brandTemplates : {};
    return source.items && typeof source.items === "object" ? source.items : {};
  }

  function getBrandTemplate(brand) {
    const templates = getBrandTemplates();
    const slug = normalizeBrandSlug(brand);
    return slug && templates[slug] && typeof templates[slug] === "object" ? templates[slug] : null;
  }

  function getActiveBrandName() {
    if (state.filters.brand && state.filters.brand !== "Todas") return state.filters.brand;
    if (metadata.brandFilter) return metadata.brandFilter;
    if (metadata.activeBrand && metadata.activeBrand.name) return metadata.activeBrand.name;
    const brands = [...new Set(state.products.map(getProductBrand).filter(Boolean))];
    return brands.length === 1 ? brands[0] : "";
  }

  function getCurrentBrandTemplate() {
    return getBrandTemplate(getActiveBrandName());
  }

  function getProductBrandTemplate(product) {
    return getBrandTemplate(getProductBrand(product));
  }

  function getProductPlaceholder(product) {
    const brandTemplate = getProductBrandTemplate(product);
    return brandTemplate?.placeholder || metadata.brandTemplates?.defaultPlaceholder || "./assets/img/no-photo-camera.svg";
  }

  function buildNoPhotoMarkup(product, compact = false) {
    const placeholder = getProductPlaceholder(product);
    return `
      <div class="product-no-photo${compact ? " product-no-photo--compact" : ""}">
        <img src="${escapeHtml(placeholder)}" alt="Sin foto" loading="lazy" decoding="async">
        <span>Sin foto</span>
      </div>
    `;
  }

  function applyProductViewCounts(counts) {
    if (!counts || typeof counts !== "object") return;
    state.products.forEach((product) => {
      const raw = counts[product.item] || counts[String(product.item || "")];
      const views = typeof raw === "number" ? raw : Number(raw?.views || raw?.view_count || 0);
      product.viewCount = Number.isFinite(views) && views > 0 ? Math.floor(views) : 0;
      product.lastViewedAt = raw?.last_viewed_at || raw?.lastViewedAt || "";
    });
  }

  function getProductViewCount(product) {
    const count = Number(product?.viewCount || product?.views || product?.view_count || 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }

  function formatViewCount(count) {
    const value = Number(count) || 0;
    if (value <= 0) return "Detalle";
    return value === 1 ? "1 vista" : `${value} vistas`;
  }

  function updateProductViewBadges(product) {
    const item = String(product?.item || "");
    if (!item) return;
    document.querySelectorAll(`[data-product-view-item="${cssAttributeEscape(item)}"]`).forEach((node) => {
      node.textContent = isProductUnavailable(product) ? "Agotado" : formatViewCount(getProductViewCount(product));
    });
  }

  function renderFilters() {
    if (!els.categoryFilters) return;
    const categories = ["Todos", ...[...new Set(state.products.map(getProductCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b))];
    const brands = getAvailableFilterBrands();
    const showBrandFilter = shouldShowBrandFilter(brands);
    els.categoryFilters.innerHTML = "";
    renderFilterSelect("Categoria", categories, state.filters.category, (category) => {
      state.filters.category = category;
      state.currentPage = 1;
      applyFilters();
      trackCatalogEvent("category_filter", {
        metadata: { category }
      });
    });
    if (showBrandFilter) {
      renderFilterSelect("Marca", ["Todas las marcas", ...brands], state.filters.brand === "Todas" ? "Todas las marcas" : state.filters.brand, (brand) => {
        if (brand === "Todas las marcas") brand = "Todas";
        state.filters.brand = brand;
        state.currentPage = 1;
        renderFilters();
        hydrateHeader();
        safeHydratePromotion();
        applyFilters();
        trackCatalogEvent("brand_filter", {
          metadata: { brand }
        });
      });
    } else {
      state.filters.brand = "Todas";
    }
    const sortOptions = getSortOptions();
    renderFilterSelect("Orden", sortOptions.map((option) => option.label), getSortLabel(state.sortMode), (label) => {
      const option = sortOptions.find((item) => item.label === label) || sortOptions[0];
      state.sortMode = option.value;
      state.currentPage = 1;
      applyFilters();
      trackCatalogEvent("sort_filter", {
        metadata: { sort: state.sortMode }
      });
    });
    renderFeaturedBrands(brands);
  }

  function shouldShowFeaturedBrands(brands) {
    if (isEntryScopedCatalog()) return false;
    if (!Array.isArray(brands) || brands.length <= 1) return false;
    if (metadata.showFeaturedBrands === false) return false;
    if (typeof metadata.brandExportMode === "string") {
      return metadata.brandExportMode === "complete";
    }
    return shouldShowBrandFilter(brands);
  }

  function getFeaturedBrands(brands) {
    const availableBySlug = new Map(brands.map((brand) => [normalizeBrandSlug(brand), brand]));
    const source = Array.isArray(metadata.featuredBrands) && metadata.featuredBrands.length
      ? metadata.featuredBrands
      : DEFAULT_FEATURED_BRANDS;

    return source
      .map((brand) => {
        const name = typeof brand === "string" ? brand : brand?.name;
        const slug = normalizeBrandSlug(typeof brand === "string" ? brand : (brand?.slug || name));
        const availableName = availableBySlug.get(slug);
        if (!availableName) return null;
        return {
          name: availableName,
          slug,
          logo: typeof brand === "object" && brand?.logo ? brand.logo : `./assets/brands/${slug}.png`
        };
      })
      .filter(Boolean);
  }

  function renderFeaturedBrands(brands) {
    document.querySelectorAll(".featured-brands").forEach((node) => node.remove());
    const mount = getFeaturedBrandsMount();
    if (!mount || !shouldShowFeaturedBrands(brands)) return;
    const featuredBrands = getFeaturedBrands(brands);
    if (!featuredBrands.length) return;

    const section = document.createElement("div");
    section.className = "featured-brands";
    section.innerHTML = `
      <div class="featured-brands__title">Marcas destacadas</div>
      <div class="featured-brands__grid"></div>
    `;

    const grid = section.querySelector(".featured-brands__grid");
    featuredBrands.forEach((brand) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `featured-brand-button${state.filters.brand === brand.name ? " is-active" : ""}`;
      button.setAttribute("aria-label", `Ver productos ${brand.name}`);
      button.innerHTML = `
        <img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.name)}" loading="lazy" decoding="async">
        <span>${escapeHtml(brand.name)}</span>
      `;
      button.querySelector("img")?.addEventListener("error", (event) => {
        event.currentTarget.hidden = true;
        button.classList.add("featured-brand-button--text-only");
      });
      button.addEventListener("click", () => {
        state.filters.brand = brand.name;
        state.currentPage = 1;
        renderFilters();
        hydrateHeader();
        safeHydratePromotion();
        applyFilters();
        trackCatalogEvent("featured_brand_filter", {
          metadata: { brand: brand.name }
        });
      });
      grid.appendChild(button);
    });

    mount.appendChild(section);
  }

  function getFeaturedBrandsMount() {
    if (els.featuredBrandsMount) return els.featuredBrandsMount;
    return els.resultCount?.parentElement || null;
  }

  function getAvailableFilterBrands() {
    const metadataBrands = Array.isArray(metadata.brands)
      ? metadata.brands.map((brand) => typeof brand === "string" ? brand : brand && brand.name).filter(Boolean)
      : [];
    const productBrands = state.products.map(getProductBrand).filter(Boolean);
    const productsByBrand = new Set(productBrands);
    const source = metadataBrands.length ? metadataBrands.filter((brand) => productsByBrand.has(brand)) : productBrands;
    return [...new Set(source)].sort(compareBrandsForCatalogStart);
  }

  function compareBrandsForCatalogStart(a, b) {
    const priority = getBrandPriority(a) - getBrandPriority(b);
    return priority || a.localeCompare(b);
  }

  function shouldShowBrandFilter(brands) {
    if (isEntryScopedCatalog()) return false;
    if (!Array.isArray(brands) || brands.length <= 1) return false;
    if (typeof metadata.brandFilterEnabled === "boolean") return metadata.brandFilterEnabled === true;
    return brands.length > 1;
  }

  function renderFilterSelect(label, values, activeValue, onSelect) {
    if (!els.categoryFilters || !values.length) return;
    const group = document.createElement("div");
    const selectId = `filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    group.className = "filters__group filters__group--select";
    group.innerHTML = `<label class="filters__label" for="${escapeHtml(selectId)}">${escapeHtml(label)}</label>`;
    const select = document.createElement("select");
    select.id = selectId;
    select.className = "filters__select";
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      if (value === activeValue) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", () => onSelect(select.value));
    group.appendChild(select);
    els.categoryFilters.appendChild(group);
  }

  function applyFilters() {
    const search = state.filters.search;
    state.filtered = state.products.filter((product) => {
      const matchesCategory = state.filters.category === "Todos" || getProductCategory(product) === state.filters.category;
      const brand = getProductBrand(product);
      const matchesBrand = state.filters.brand === "Todas" || brand === state.filters.brand;
      const haystack = [
        product.item,
        product.description,
        product.shortDescription,
        brand,
        product.smartCategory,
        product.category,
        product.categoryOriginal,
        product.material
      ].join(" ").toLowerCase();
      return matchesCategory && matchesBrand && (!search || haystack.includes(search));
    }).sort(compareProductsForSortMode);
    state.currentPage = Math.min(state.currentPage, getTotalPages());
    renderProducts();
  }

  function getSortLabel(sortMode) {
    const sortOptions = getSortOptions();
    return (sortOptions.find((option) => option.value === sortMode) || sortOptions[0]).label;
  }

  function getSortOptions() {
    if (!isEntryScopedCatalog()) return SORT_OPTIONS;
    return SORT_OPTIONS.map((option) => option.value === "featured" ? { ...option, label: "Orden original" } : option);
  }

  function compareProductsForSortMode(a, b) {
    if (state.sortMode === "item-asc") {
      return compareText(a.item, b.item) || compareOriginalOrder(a, b);
    }
    if (state.sortMode === "description-asc") {
      return compareText(getProductDescription(a), getProductDescription(b)) || compareText(a.item, b.item) || compareOriginalOrder(a, b);
    }
    if (isEntryScopedCatalog()) return compareOriginalOrder(a, b);
    const brandPriority = getBrandPriority(getProductBrand(a)) - getBrandPriority(getProductBrand(b));
    return brandPriority || compareOriginalOrder(a, b);
  }

  function compareText(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function compareOriginalOrder(a, b) {
    return (Number(a?.__catalogIndex) || 0) - (Number(b?.__catalogIndex) || 0);
  }

  function renderProducts() {
    if (!els.productGrid) return;
    els.productGrid.innerHTML = "";
    ensurePaginationControls();
    const totalPages = getTotalPages();
    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
    const start = (state.currentPage - 1) * state.productsPerPage;
    const visibleProducts = state.filtered.slice(start, start + state.productsPerPage);
    if (els.resultCount) {
      const rangeStart = state.filtered.length ? start + 1 : 0;
      const rangeEnd = Math.min(start + visibleProducts.length, state.filtered.length);
      els.resultCount.textContent = totalPages > 1
        ? `${rangeStart}-${rangeEnd} de ${state.filtered.length} productos`
        : `${state.filtered.length} productos visibles`;
    }

    visibleProducts.forEach((product, index) => {
      const isUnavailable = isProductUnavailable(product);
      const card = document.createElement("article");
      card.className = `product-card${isUnavailable ? " product-card--out-of-stock" : ""}`;
      card.innerHTML = `
        <div class="product-card__media">
          <div class="product-card__empty">Cargando imagen</div>
          <span class="product-card__count" data-product-view-item="${escapeHtml(product.item || "")}">${isUnavailable ? "Agotado" : formatViewCount(getProductViewCount(product))}</span>
        </div>
        <div class="product-card__body">
          <div class="sku">${escapeHtml(product.item || "SKU")}</div>
          ${getProductBrand(product) ? `<div class="product-card__brand">${escapeHtml(getProductBrand(product))}</div>` : ""}
          <h3>${escapeHtml(product.description || product.shortDescription || product.item || "Producto")}</h3>
          <div class="product-card__meta">
            <div><span>Categoria</span><strong>${escapeHtml(getProductCategory(product))}</strong></div>
            ${getProductBrand(product) ? `<div><span>Marca</span><strong>${escapeHtml(getProductBrand(product))}</strong></div>` : ""}
            <div><span>Empaque</span><strong>${escapeHtml(product.packageLabel || product.package || product.empaque || "Unidad")}</strong></div>
            <div><span>Venta</span><strong>${escapeHtml(getDisplaySaleUnit(product))}</strong></div>
            <div><span>Minimo</span><strong>${escapeHtml(String(getMinimumQty(product)))}</strong></div>
          </div>
          <div class="product-card__availability${isUnavailable ? " product-card__availability--out" : ""}"><span>${isUnavailable ? "Estado:" : "Disp:"}</span><strong>${escapeHtml(isUnavailable ? "Articulo agotado" : (product.available || "-"))}</strong></div>
          <div class="product-card__footer">
            <div class="product-card__price">${escapeHtml(formatMoney(parsePrice(product.price)))}</div>
            <div class="product-card__actions">
              <button class="button-secondary" type="button">Ver detalle</button>
              <button class="button-primary" type="button" ${isUnavailable ? "disabled" : ""}>${isUnavailable ? "Agotado" : "Agregar"}</button>
            </div>
          </div>
        </div>
      `;
      const [detailButton, addButton] = card.querySelectorAll("button");
      detailButton.addEventListener("click", () => openDetail(product));
      addButton.addEventListener("click", () => addToCart(product, getMinimumQty(product)));
      card.querySelector(".product-card__media")?.addEventListener("click", () => openDetail(product));
      els.productGrid.appendChild(card);
      hydrateProductCardMedia(card, product, index);
    });
    renderPaginationControls();
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(state.filtered.length / state.productsPerPage));
  }

  function ensurePaginationControls() {
    if (!els.pagination && els.productGrid) {
      els.pagination = document.createElement("div");
      els.pagination.className = "catalog-pagination";
      els.productGrid.insertAdjacentElement("afterend", els.pagination);
    }
    if (!els.backToTop) {
      els.backToTop = document.createElement("button");
      els.backToTop.className = "catalog-back-top";
      els.backToTop.type = "button";
      els.backToTop.textContent = "Subir";
      els.backToTop.addEventListener("click", () => {
        (els.productGrid || document.querySelector(".catalog-layout") || document.body).scrollIntoView({ behavior: "smooth", block: "start" });
      });
      document.body.appendChild(els.backToTop);
      updateFloatingActions();
    }
  }

  function renderPaginationControls() {
    if (!els.pagination) return;
    const totalPages = getTotalPages();
    if (totalPages <= 1) {
      els.pagination.hidden = true;
      els.pagination.innerHTML = "";
      return;
    }
    els.pagination.hidden = false;
    els.pagination.innerHTML = `
      <button type="button" data-page-action="prev" ${state.currentPage <= 1 ? "disabled" : ""}>Anterior</button>
      <span>Pagina ${state.currentPage} de ${totalPages}</span>
      <button type="button" data-page-action="next" ${state.currentPage >= totalPages ? "disabled" : ""}>Siguiente</button>
    `;
    els.pagination.querySelector('[data-page-action="prev"]')?.addEventListener("click", () => changePage(state.currentPage - 1));
    els.pagination.querySelector('[data-page-action="next"]')?.addEventListener("click", () => changePage(state.currentPage + 1));
  }

  function changePage(page) {
    state.currentPage = Math.min(Math.max(1, page), getTotalPages());
    renderProducts();
    (els.productGrid || document.querySelector(".catalog-layout") || document.body).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateBackToTopVisibility() {
    if (!els.backToTop) return;
    els.backToTop.classList.toggle("is-visible", window.scrollY > 600);
  }

  function updateFloatingActions() {
    updateBackToTopVisibility();

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
    const nearEnd = scrollTop + viewportHeight >= documentHeight - 180;

    document.body.classList.toggle("catalog-has-scrolled", scrollTop > 160);
    document.body.classList.toggle("catalog-at-page-end", nearEnd);
    document.body.classList.add("catalog-floating-scrolling");
    document.body.classList.remove("catalog-floating-idle");

    window.clearTimeout(floatingScrollTimer);
    floatingScrollTimer = window.setTimeout(() => {
      document.body.classList.remove("catalog-floating-scrolling");
      document.body.classList.add("catalog-floating-idle");
    }, 650);
  }

  function buildGallery(product) {
    const media = product.media || {};
    const images = [];
    if (media.mainImage) images.push(media.mainImage);
    if (Array.isArray(media.gallery)) media.gallery.forEach((src) => src && images.push(src));
    return [...new Set(images)];
  }

  // Modulo de fuente de imagenes hibridas para catalogo publico: remoto, local e hibrido inteligente.
  function buildCandidateGroups(product) {
    const media = product.media || {};
    const remoteImageUrl = resolveRemoteProductImageUrl(product);
    const preferRemote = media.imageSourceMode === "remote" || media.imageSourceMode === "hybrid" || media.imageStorageMode === "backblaze" || media.imageStorageMode === "hybrid";
    if (Array.isArray(media.galleryCandidateGroups) && media.galleryCandidateGroups.length) {
      const groups = media.galleryCandidateGroups.map((group) => Array.isArray(group) ? group.filter(Boolean) : []).filter((group) => group.length);
      const preferredRemoteGroup = preferRemote && remoteImageUrl ? [[remoteImageUrl]] : [];
      if (Array.isArray(media.mainImageCandidates) && media.mainImageCandidates.length) {
        return [...preferredRemoteGroup, media.mainImageCandidates.filter(Boolean), ...groups];
      }
      return [...preferredRemoteGroup, ...groups];
    }

    const groups = [];
    if (preferRemote && remoteImageUrl) {
      groups.push([remoteImageUrl]);
    }
    if (Array.isArray(media.mainImageCandidates) && media.mainImageCandidates.length) {
      groups.push(media.mainImageCandidates.filter(Boolean));
    } else if (media.mainImage) {
      groups.push([media.mainImage]);
    }
    if (Array.isArray(media.gallery)) {
      media.gallery.forEach((src) => {
        if (src) groups.push([src]);
      });
    }
    return groups.filter((group) => group.length);
  }

  function resolveRemoteProductImageUrl(product) {
    const media = product.media || {};
    const url = product.remote_image_url || product.remoteImageUrl || media.remote_image_url || media.remoteImageUrl || "";
    return /^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : "";
  }

  async function resolveProductMedia(product) {
    const cacheKey = `${product.item || "item"}::${JSON.stringify(product.media || {})}`;
    if (state.mediaCache.has(cacheKey)) return state.mediaCache.get(cacheKey);
    const promise = (async () => {
      const groups = buildCandidateGroups(product);
      const gallery = [];
      for (const group of groups) {
        const resolved = await resolveFirstAvailableImage(group);
        if (resolved) gallery.push(resolved);
      }
      return {
        gallery: [...new Set(gallery)],
        video: product.media && product.media.video ? product.media.video : "",
      };
    })();
    state.mediaCache.set(cacheKey, promise);
    return promise;
  }

  async function resolveFirstAvailableImage(candidates) {
    for (const candidate of [...new Set((candidates || []).filter(Boolean))]) {
      if (candidate.startsWith("./") || candidate.startsWith("../") || candidate.startsWith("data:")) return candidate;
      const exists = await checkImageAvailability(candidate);
      if (exists) return candidate;
    }
    return "";
  }

  async function checkImageAvailability(url) {
    if (state.imageProbeCache.has(url)) return state.imageProbeCache.get(url);
    const probe = (async () => {
      try {
        const response = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (response.ok) return true;
      } catch (error) {
      }

      return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url;
      });
    })();
    state.imageProbeCache.set(url, probe);
    const result = await probe;
    state.imageProbeCache.set(url, Promise.resolve(result));
    return result;
  }

  function getProductImageCandidates(product) {
    const groups = buildCandidateGroups(product);
    return [...new Set(groups.flat().filter(Boolean))];
  }

  function getProductCardImageCandidates(product) {
    const media = product.media || {};
    const cardCandidates = [
      product.thumbnail_url,
      product.thumbnailUrl,
      product.cardImage,
      media.thumbnail,
      media.thumbnailUrl,
      media.cardImage,
      ...(Array.isArray(media.cardImageCandidates) ? media.cardImageCandidates : [])
    ].filter(Boolean);
    return [...new Set([...cardCandidates, ...getProductImageCandidates(product)])];
  }

  function getProductImageGroupCount(product) {
    return buildCandidateGroups(product).length;
  }

  function attachImageFallback(image, candidates, product = null, compact = false) {
    const queue = [...new Set((candidates || []).filter(Boolean))];
    let index = Math.max(0, queue.indexOf(image.getAttribute("src") || ""));
    image.addEventListener("error", () => {
      index += 1;
      const next = queue[index] || "";
      if (next) {
        image.src = next;
      } else {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = buildNoPhotoMarkup(product || {}, compact);
        image.replaceWith(wrapper.firstElementChild || Object.assign(document.createElement("div"), {
          className: "product-card__empty",
          textContent: "Sin foto"
        }));
      }
    });
  }

  async function hydrateProductCardMedia(card, product, index = 0) {
    const mediaRoot = card.querySelector(".product-card__media");
    const countNode = card.querySelector(".product-card__count");
    if (!mediaRoot || !countNode) return;
    const candidates = getProductCardImageCandidates(product);
    const mainImage = candidates[0] || "";
    const isPriority = index < 8;
    const isUnavailable = isProductUnavailable(product);
    mediaRoot.innerHTML = mainImage
      ? `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.description || product.item)}" loading="${isPriority ? "eager" : "lazy"}" decoding="async" fetchpriority="${isPriority ? "high" : "auto"}">`
      : buildNoPhotoMarkup(product, true);
    const image = mediaRoot.querySelector("img");
    if (image && mainImage) attachImageFallback(image, candidates, product, true);
    countNode.textContent = isUnavailable ? "Agotado" : formatViewCount(getProductViewCount(product));
    mediaRoot.appendChild(countNode);
  }

  async function openDetail(product) {
    state.activeProduct = product;
    state.activeMediaIndex = 0;
    if (els.calcQty) els.calcQty.value = String(getMinimumQty(product));
    if (els.detailTitle) els.detailTitle.textContent = product.description || product.item || "Producto";
    if (els.detailSubtitle) {
      els.detailSubtitle.textContent = `${product.item || ""} · ${getProductCategory(product)} · ${formatMoney(parsePrice(product.price))}`;
    }
    await renderDetailMedia();
    renderDetailSpecs(product);
    updateCalculator();
    els.detailOverlay?.classList.add("open");
    trackProductEvent("product_detail", product);
    product.viewCount = getProductViewCount(product) + 1;
    updateProductViewBadges(product);
  }

  function closeDetail() {
    els.detailOverlay?.classList.remove("open");
  }

  async function renderDetailMedia() {
    if (!state.activeProduct || !els.detailStage || !els.detailThumbs) return;
    const resolvedMedia = await resolveProductMedia(state.activeProduct);
    const gallery = resolvedMedia.gallery;
    const video = resolvedMedia.video;
    const items = gallery.map((src) => ({ type: "image", src }));
    if (video) items.push({ type: "video", src: video });
    const active = items[state.activeMediaIndex] || null;

    els.detailStage.innerHTML = active
      ? active.type === "video"
        ? `<video controls playsinline preload="metadata"><source src="${escapeHtml(active.src)}"></video>`
        : `<button class="detail-image-zoom-trigger" type="button" data-zoom-src="${escapeHtml(active.src)}" aria-label="Ampliar imagen"><img src="${escapeHtml(active.src)}" alt="" loading="eager" decoding="async"></button>`
      : buildNoPhotoMarkup(state.activeProduct, false);
    const detailImage = els.detailStage.querySelector(".detail-image-zoom-trigger img");
    if (detailImage && active?.type === "image") {
      attachImageFallback(detailImage, getProductImageCandidates(state.activeProduct), state.activeProduct, false);
    }
    els.detailStage.querySelector(".detail-image-zoom-trigger")?.addEventListener("click", (event) => {
      const src = event.currentTarget.getAttribute("data-zoom-src") || "";
      if (src) openImageZoom(src);
    });

    els.detailThumbs.innerHTML = "";
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === state.activeMediaIndex ? "active" : "";
      button.innerHTML = item.type === "video"
        ? `<span class="thumb-video">Video</span>`
        : `<img src="${escapeHtml(item.src)}" alt="" loading="lazy" decoding="async">`;
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

  function openImageZoom(src) {
    const normalizedSrc = String(src || "").trim();
    if (!normalizedSrc) return;
    const overlay = ensureImageZoomOverlay();
    const image = overlay.querySelector("img");
    if (image) image.src = normalizedSrc;
    overlay.classList.add("open");
  }

  function closeImageZoom() {
    if (!imageZoomOverlay) return;
    imageZoomOverlay.classList.remove("open");
    const image = imageZoomOverlay.querySelector("img");
    if (image) image.removeAttribute("src");
  }

  function ensureImageZoomOverlay() {
    if (imageZoomOverlay) return imageZoomOverlay;
    imageZoomOverlay = document.createElement("div");
    imageZoomOverlay.className = "image-zoom-overlay";
    imageZoomOverlay.innerHTML = `
      <div class="image-zoom-card" role="dialog" aria-modal="true" aria-label="Imagen ampliada">
        <button class="image-zoom-close" type="button">Cerrar</button>
        <img alt="">
      </div>
    `;
    imageZoomOverlay.addEventListener("click", (event) => {
      if (event.target === imageZoomOverlay) closeImageZoom();
    });
    imageZoomOverlay.querySelector(".image-zoom-close")?.addEventListener("click", closeImageZoom);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && imageZoomOverlay?.classList.contains("open")) closeImageZoom();
    });
    document.body.appendChild(imageZoomOverlay);
    return imageZoomOverlay;
  }

  function renderDetailSpecs(product) {
    if (!els.detailSpecs) return;
    const specs = [
      ["SKU", product.item || "-"],
      ["Categoria", getProductCategory(product)],
      ["Marca", getProductBrand(product)],
      ["Material", product.material || ""],
      ["Tamano", product.size || product.measureBadge || ""],
      ["Disponibilidad", product.available || "-"],
      ["Venta", getDisplaySaleUnit(product)],
      ["Empaque", `${product.packageLabel || product.package || product.empaque || "Unidad"} / ${getPackSize(product)}`],
      ["Minimo", String(getMinimumQty(product))],
      ["Multiplo", String(getMultipleQty(product))]
    ].filter(([, value]) => String(value || "").trim() !== "");
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
    if (isProductUnavailable(state.activeProduct)) {
      els.calcBreakdown.innerHTML = `<div class="summary-row"><span>Estado</span><strong>Articulo agotado</strong></div>`;
      if (els.calcAdd) els.calcAdd.disabled = true;
      return;
    }
    if (els.calcAdd) els.calcAdd.disabled = false;
    const qty = normalizeQuantity(Number(els.calcQty.value) || getMinimumQty(state.activeProduct), state.activeProduct);
    const packSize = getPackSize(state.activeProduct);
    const totalPieces = qty * packSize;
    const totalAmount = totalPieces * parsePrice(state.activeProduct.price);
    els.calcQty.value = String(qty);
    els.calcBreakdown.innerHTML = `
      <div class="summary-row"><span>Bultos seleccionados</span><strong>${qty} ${escapeHtml(getDisplaySaleUnit(state.activeProduct))}</strong></div>
      <div class="summary-row"><span>Piezas por bulto</span><strong>${packSize}</strong></div>
      <div class="summary-row"><span>Total de piezas</span><strong>${totalPieces}</strong></div>
      <div class="summary-row"><span>Total estimado</span><strong>${formatMoney(totalAmount)}</strong></div>
    `;
  }

  function addToCart(product, quantity) {
    if (isProductUnavailable(product)) {
      if (els.checkoutStatus) els.checkoutStatus.textContent = "Este articulo esta agotado y no se puede agregar.";
      return;
    }
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
    pruneUnavailableCartItems();
    const items = Array.from(state.cart.values());
    const cartCount = items.reduce((sum, entry) => sum + entry.quantity, 0);
    if (els.cartButton) {
      let label = els.cartButton.querySelector(".cart-button-label");
      let badge = els.cartButton.querySelector(".cart-badge");
      Array.from(els.cartButton.childNodes).forEach((node) => {
        if (node.nodeType === 3 && node.textContent.trim()) node.remove();
      });
      if (!label) {
        label = document.createElement("span");
        label.className = "cart-button-label";
        label.textContent = "Carrito";
        els.cartButton.prepend(label);
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cart-badge";
        badge.id = "cartBadge";
        els.cartButton.appendChild(badge);
        els.cartBadge = badge;
      }
      els.cartButton.setAttribute("aria-label", cartCount > 0 ? `Abrir carrito, ${cartCount} productos` : "Abrir carrito");
    }
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
          <div class="muted">${escapeHtml(getDisplaySaleUnit(entry.product))} · ${escapeHtml(entry.product.packageLabel || entry.product.package || "Empaque")}</div>
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

    if (state.reviewModal?.classList.contains("open")) {
      renderOrderReview();
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

  function openOrderReview(event) {
    if (event) event.preventDefault();
    if (!validateCheckoutDetails()) return;
    if (!buildOrderPayload({ customerConfirmed: false })) return;
    ensureOrderReviewModal();
    renderOrderReview();
    if (state.reviewConfirm) state.reviewConfirm.checked = false;
    if (state.reviewStatus) state.reviewStatus.textContent = "";
    state.reviewModal?.classList.add("open");
    closeCartDrawer();
    const reviewCard = state.reviewModal?.querySelector(".order-review__card");
    if (reviewCard) reviewCard.scrollTop = 0;
  }

  function validateCheckoutDetails() {
    const requiredFields = [
      [byId("companyName"), "Indica la empresa para continuar."],
      [byId("contactName"), "Indica el contacto para continuar."],
      [byId("contactPhone"), "Indica el telefono para continuar."]
    ];

    for (const [field, message] of requiredFields) {
      if (field && !field.value.trim()) {
        setCheckoutError(message, field);
        return false;
      }
    }

    const emailField = byId("contactEmail");
    if (emailField && emailField.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value.trim())) {
      setCheckoutError("Revisa el correo antes de continuar.", emailField);
      return false;
    }

    if (els.checkoutStatus) els.checkoutStatus.textContent = "";
    return true;
  }

  function setCheckoutError(message, field) {
    if (els.checkoutStatus) {
      els.checkoutStatus.textContent = message;
    }
    if (state.reviewStatus) {
      state.reviewStatus.textContent = message;
    }
    if (field && typeof field.focus === "function") {
      try {
        field.focus({ preventScroll: true });
      } catch (error) {
        field.focus();
      }
      field.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function ensureOrderReviewModal() {
    if (state.reviewModal) return;
    const modal = document.createElement("div");
    modal.className = "overlay order-review";
    modal.id = "orderReviewOverlay";
    modal.innerHTML = `
      <div class="modal-card order-review__card" role="dialog" aria-modal="true" aria-labelledby="orderReviewTitle">
        <div class="toolbar">
          <div>
            <strong id="orderReviewTitle">Revisar pedido</strong>
            <div class="muted">Verifica productos, cantidades y datos antes del envio.</div>
          </div>
          <button class="button-secondary" id="orderReviewBack" type="button">Regresar al catalogo</button>
        </div>
        <div class="order-review__customer" id="orderReviewCustomer"></div>
        <div class="order-review__lines" id="orderReviewLines"></div>
        <div class="cart-summary" id="orderReviewSummary"></div>
        <div class="order-review__actions">
          <label class="order-review__confirm">
            <input id="orderReviewConfirm" type="checkbox">
            <span>Confirmo que revise mi pedido y autorizo el envio.</span>
          </label>
          <button class="checkout-button" id="orderReviewSubmit" type="button">Enviar pedido confirmado</button>
          <p class="status-note" id="orderReviewStatus"></p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    state.reviewModal = modal;
    state.reviewStatus = byId("orderReviewStatus");
    state.reviewConfirm = byId("orderReviewConfirm");
    state.reviewSubmit = byId("orderReviewSubmit");
    byId("orderReviewBack")?.addEventListener("click", closeOrderReview);
    state.reviewConfirm?.addEventListener("change", () => {
      if (state.reviewStatus) state.reviewStatus.textContent = "";
    });
    state.reviewSubmit?.addEventListener("click", () => {
      if (!state.reviewConfirm?.checked) {
        if (state.reviewStatus) state.reviewStatus.textContent = "Debes marcar la confirmacion para enviar el pedido.";
        return;
      }
      submitOrder(null, buildOrderPayload({ customerConfirmed: true }), true);
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeOrderReview();
    });
  }

  function closeOrderReview() {
    state.reviewModal?.classList.remove("open");
  }

  function renderOrderReview() {
    const customerNode = byId("orderReviewCustomer");
    const linesNode = byId("orderReviewLines");
    const summaryNode = byId("orderReviewSummary");
    const entries = Array.from(state.cart.values());
    const payload = buildOrderPayload({ customerConfirmed: false, silent: true });

    if (customerNode && payload) {
      customerNode.innerHTML = `
        <div><span>Empresa</span><strong>${escapeHtml(payload.company_name || "No indicada")}</strong></div>
        <div><span>Contacto</span><strong>${escapeHtml(payload.contact_name || "")}</strong></div>
        <div><span>Telefono</span><strong>${escapeHtml(payload.contact_phone || "")}</strong></div>
        <div><span>Correo</span><strong>${escapeHtml(payload.contact_email || "No indicado")}</strong></div>
      `;
    }

    if (linesNode) {
      linesNode.innerHTML = entries.length ? "" : `<p class="cart-empty">No hay productos para revisar.</p>`;
      entries.forEach((entry) => {
        const packSize = getPackSize(entry.product);
        const pieces = entry.quantity * packSize;
        const lineTotal = pieces * parsePrice(entry.product.price);
        const imageUrl = buildGallery(entry.product)[0] || "";
        const line = document.createElement("article");
        line.className = "order-review__line";
        line.innerHTML = `
          <div class="order-review__thumb">
            ${imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(entry.product.description || entry.product.item || "Producto")}" loading="lazy" decoding="async">`
              : `<span>Sin foto</span>`}
          </div>
          <div class="order-review__info">
            <strong>${escapeHtml(entry.product.description || entry.product.item)}</strong>
            <div class="muted">${escapeHtml(entry.product.item || "")} · ${escapeHtml(getDisplaySaleUnit(entry.product))}</div>
          </div>
          <div class="qty-controls">
            <button type="button" aria-label="Restar cantidad">-</button>
            <input type="number" min="${getMinimumQty(entry.product)}" value="${entry.quantity}">
            <button type="button" aria-label="Sumar cantidad">+</button>
            <button type="button" aria-label="Eliminar producto">x</button>
          </div>
          <div><strong>${formatMoney(lineTotal)}</strong><div class="muted">${pieces} piezas</div></div>
        `;
        line.querySelector(".order-review__thumb img")?.addEventListener("error", (event) => {
          const thumb = event.currentTarget.closest(".order-review__thumb");
          if (thumb) thumb.innerHTML = "<span>Sin foto</span>";
        });
        const [minus, input, plus, remove] = line.querySelectorAll("button, input");
        minus.addEventListener("click", () => updateCartQty(entry.key, entry.quantity - getMultipleQty(entry.product)));
        plus.addEventListener("click", () => updateCartQty(entry.key, entry.quantity + getMultipleQty(entry.product)));
        input.addEventListener("change", () => updateCartQty(entry.key, Number(input.value) || entry.quantity));
        remove.addEventListener("click", () => {
          state.cart.delete(entry.key);
          renderCart();
          trackProductEvent("remove_from_cart", entry.product);
        });
        linesNode.appendChild(line);
      });
    }

    if (summaryNode) {
      const total = entries.reduce((sum, entry) => sum + entry.quantity * getPackSize(entry.product) * parsePrice(entry.product.price), 0);
      summaryNode.innerHTML = `
        <div class="summary-row"><span>Productos</span><strong>${entries.length}</strong></div>
        <div class="summary-row"><span>Vendedor</span><strong>${escapeHtml(state.publicContext?.seller?.name || "General")}</strong></div>
        <div class="summary-row"><span>Total confirmado</span><strong>${formatMoney(total)}</strong></div>
      `;
    }
  }

  async function submitOrder(event, forcedPayload, interactive = false) {
    if (event) event.preventDefault();
    const isUserSubmit = !forcedPayload || interactive;
    const payload = forcedPayload || buildOrderPayload();
    if (!payload) return;
    if (!payload.customer_confirmed) {
      if (state.reviewStatus) state.reviewStatus.textContent = "Debes confirmar que revisaste el pedido.";
      if (els.checkoutStatus) els.checkoutStatus.textContent = "Debes confirmar que revisaste el pedido.";
      return;
    }

    const apiBaseUrl = sanitizeBaseUrl(metadata.apiBaseUrl);
    if (!apiBaseUrl || state.isOffline) {
      enqueueOfflineOrder(payload);
      trackCatalogEvent("offline_order_queued", {
        metadata: { item_count: payload.items.length, source_channel: payload.source_channel }
      });
      if (isUserSubmit) {
        state.cart.clear();
        renderCart();
        els.checkoutForm?.reset();
      }
      closeOrderReview();
      if (els.checkoutStatus) {
        els.checkoutStatus.textContent = "Pedido guardado localmente. Se reenviara cuando vuelva la conexion.";
      }
      return;
    }

    const submitButton = byId("checkoutButton");
    const reviewSubmit = state.reviewSubmit;
    if (submitButton && isUserSubmit) submitButton.disabled = true;
    if (reviewSubmit && isUserSubmit) reviewSubmit.disabled = true;
    if (els.checkoutStatus && isUserSubmit) els.checkoutStatus.textContent = "Enviando pedido...";
    if (state.reviewStatus && isUserSubmit) state.reviewStatus.textContent = "Enviando pedido confirmado...";
    if (isUserSubmit) {
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

      if (isUserSubmit) {
        state.cart.clear();
        renderCart();
        els.checkoutForm?.reset();
        closeOrderReview();
        if (els.checkoutStatus) els.checkoutStatus.textContent = `Pedido registrado con numero ${result.order.order_number}.`;
        trackCatalogEvent("order_submit_success", {
          value_amount: result.order.total || 0,
          metadata: { order_number: result.order.order_number, item_count: payload.items.length }
        });
      }
      return result;
    } catch (error) {
      if (!isUserSubmit) throw error;
      trackCatalogEvent("order_submit_failed", {
        metadata: { message: error.message || "order failed", server: Boolean(error.serverResponse) }
      });
      if (error.serverResponse) {
        const errorMessage = error.details ? `${error.message}: ${error.details}` : error.message;
        if (state.reviewStatus) {
          state.reviewStatus.textContent = errorMessage;
        }
        if (els.checkoutStatus) {
          els.checkoutStatus.textContent = errorMessage;
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
      closeOrderReview();
      if (els.checkoutStatus) {
        els.checkoutStatus.textContent = "No hubo conexion estable. El pedido quedo guardado para reenvio automatico.";
      }
    } finally {
      if (submitButton && isUserSubmit) submitButton.disabled = false;
      if (reviewSubmit && isUserSubmit) reviewSubmit.disabled = false;
    }
  }

  function buildOrderPayload(options = {}) {
    pruneUnavailableCartItems();
    if (!state.cart.size) {
      if (!options.silent && els.checkoutStatus) els.checkoutStatus.textContent = "Agrega al menos un producto al carrito.";
      return null;
    }

    return {
      slug: metadata.slug || "",
      share_token: getShareToken(),
      seller_token: getSellerToken(),
      company_name: byId("companyName")?.value.trim() || "",
      contact_name: byId("contactName")?.value.trim() || "",
      contact_email: byId("contactEmail")?.value.trim() || "",
      customer_email: byId("contactEmail")?.value.trim() || "",
      contact_phone: byId("contactPhone")?.value.trim() || "",
      address_zone: byId("addressZone")?.value.trim() || "",
      comments: byId("comments")?.value.trim() || "",
      source_channel: state.isOffline ? "offline-sync" : "web",
      customer_confirmed: options.customerConfirmed === true,
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

  function pruneUnavailableCartItems() {
    Array.from(state.cart.entries()).forEach(([key, entry]) => {
      if (isProductUnavailable(entry.product)) state.cart.delete(key);
    });
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

  function getDisplaySaleUnit(product) {
    const unit = String((product && (product.saleUnit || product.um)) || "CTN").trim();
    return unit.toUpperCase() === "PZ" ? "CTN" : unit;
  }

  function getMinimumQty(product) {
    return Math.max(1, Number((product && (product.minimumOrder || product.minQty)) || 1));
  }

  function getMultipleQty(product) {
    return Math.max(1, Number((product && (product.multipleQty || product.multiple)) || 1));
  }

  function isProductUnavailable(product) {
    if (!product) return false;
    if (product.outOfStock === true || product.outOfStock === 1 || product.outOfStock === "1") return true;
    if (product.agotado === true || product.agotado === 1 || product.agotado === "1") return true;
    const availability = String(product.available ?? product.disponible ?? "").trim().toLowerCase();
    if (availability === "") return false;
    if (["0", "0.0", "0.00", "agotado", "sin stock", "no disponible", "out of stock"].includes(availability)) return true;
    const numeric = Number(availability.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(numeric) && numeric <= 0;
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

  function getSellerToken() {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("t") || params.get("seller_token") || "";
    if (urlToken) {
      persistSellerToken(urlToken);
      return urlToken;
    }
    try {
      return localStorage.getItem(`catalog-seller-token:${metadata.slug || "catalog"}`) || "";
    } catch (error) {
      return "";
    }
  }

  function persistSellerToken(token) {
    const normalized = String(token || "").trim();
    if (!normalized) return;
    try {
      localStorage.setItem(`catalog-seller-token:${metadata.slug || "catalog"}`, normalized);
    } catch (error) {
    }
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
      seller_token: getSellerToken(),
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
      images: Array.isArray(promotion.images) ? promotion.images : (Array.isArray(promotion.promoImages) ? promotion.promoImages : []),
      imageUrls: Array.isArray(promotion.image_urls) ? promotion.image_urls : (Array.isArray(promotion.imageUrls) ? promotion.imageUrls : []),
      videoUrl: promotion.video_url || promotion.videoUrl || "",
      linkUrl: promotion.link_url || promotion.linkUrl || "",
      linkLabel: promotion.link_label || promotion.linkLabel || "",
      slideInterval: promotion.slide_interval || promotion.slideInterval || 15000
    };
  }

  function mergePromotionMetadata(metadataPromotion, apiPromotion) {
    const base = normalizePromotion(metadataPromotion || {});
    const api = normalizePromotion(apiPromotion || {});
    const baseImages = normalizePromoImages(base, null);
    const apiImages = normalizePromoImages(api, null);
    return {
      ...base,
      title: api.title || base.title,
      text: api.text || base.text,
      imageUrl: baseImages.length ? (base.imageUrl || baseImages[0] || "") : (api.imageUrl || base.imageUrl),
      images: base.images && base.images.length ? base.images : api.images,
      imageUrls: base.imageUrls && base.imageUrls.length ? base.imageUrls : api.imageUrls,
      videoUrl: api.videoUrl || base.videoUrl,
      linkUrl: api.linkUrl || base.linkUrl,
      linkLabel: api.linkLabel || base.linkLabel,
      slideInterval: normalizePromoSlideInterval(base.slideInterval || api.slideInterval)
    };
  }

  function initCatalogGuide() {
    if (document.getElementById("catalogGuide")) return;

    const steps = [
      {
        selector: ".catalog-header",
        title: "Bienvenido al catalogo",
        text: "Explora productos, revisa informacion comercial y arma un pedido desde este enlace."
      },
      {
        selector: ".catalog-search, #catalogSearch, #categoryFilters",
        title: "Busqueda rapida",
        text: "Busca por codigo, descripcion, marca o categoria para encontrar productos en segundos."
      },
      {
        selector: "#categoryFilters",
        title: "Filtros inteligentes",
        text: "Usa categorias y marcas para ordenar la vista segun lo que necesitas comprar."
      },
      {
        selector: "#productGrid .product-card",
        compactSelector: "#productGrid .product-card__body, #productGrid .product-card",
        rememberProductCard: true,
        title: "Ficha de producto",
        text: "Cada tarjeta muestra imagen, precio, disponibilidad y acceso al detalle."
      },
      {
        selector: "#productGrid .product-card .button-secondary",
        compactSelector: "#productGrid .product-card .button-secondary",
        withinProductCard: true,
        title: "Ver detalle",
        text: "Abre el detalle para revisar imagenes, ficha tecnica, empaque y cantidades antes de agregar."
      },
      {
        selector: "#cartButton",
        title: "Carrito y pedido",
        text: "Agrega cantidades, revisa totales y completa tus datos para registrar el pedido."
      }
    ];

    let currentStep = 0;
    let activeTarget = null;
    let activeGuideProductCard = null;
    let spotlightTimer = null;
    const seenKey = `catalog-guide-seen:v1:${metadata.slug || "catalog"}`;

    const launch = document.createElement("button");
    launch.className = "catalog-guide-launch";
    launch.type = "button";
    launch.textContent = "Ver guia";
    launch.addEventListener("click", () => showGuide(0, false));
    document.body.appendChild(launch);
    updateFloatingActions();

    const backdrop = document.createElement("div");
    backdrop.className = "catalog-guide-backdrop";
    backdrop.id = "catalogGuide";
    backdrop.innerHTML = `
      <article class="catalog-guide-card" role="dialog" aria-modal="true" aria-labelledby="catalogGuideTitle">
        <p class="catalog-guide-kicker" id="catalogGuideCount"></p>
        <h2 id="catalogGuideTitle"></h2>
        <p id="catalogGuideText"></p>
        <div class="catalog-guide-progress" id="catalogGuideProgress"></div>
        <div class="catalog-guide-actions">
          <button type="button" id="catalogGuideSkip">Cerrar</button>
          <div>
            <button type="button" id="catalogGuidePrev">Anterior</button>
            <button class="catalog-guide-primary" type="button" id="catalogGuideNext">Siguiente</button>
          </div>
        </div>
      </article>
    `;
    document.body.appendChild(backdrop);

    const spotlight = document.createElement("div");
    spotlight.className = "catalog-guide-spotlight";
    document.body.appendChild(spotlight);

    byId("catalogGuideSkip")?.addEventListener("click", () => hideGuide(true));
    byId("catalogGuidePrev")?.addEventListener("click", () => showGuide(Math.max(0, currentStep - 1), false));
    byId("catalogGuideNext")?.addEventListener("click", () => {
      if (currentStep >= steps.length - 1) {
        hideGuide(true);
        return;
      }
      showGuide(currentStep + 1, false);
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) hideGuide(true);
    });
    window.addEventListener("resize", scheduleSpotlightUpdate);
    window.addEventListener("scroll", scheduleSpotlightUpdate, true);
    window.visualViewport?.addEventListener("resize", scheduleSpotlightUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleSpotlightUpdate);

    if (!hasSeenGuide(seenKey)) {
      markGuideSeen(seenKey);
      window.setTimeout(() => showGuide(0, true), 700);
    }

    function showGuide(stepIndex, automatic) {
      currentStep = Math.min(Math.max(stepIndex, 0), steps.length - 1);
      const step = steps[currentStep];
      const guide = byId("catalogGuide");
      if (!guide) return;

      byId("catalogGuideCount").textContent = `Guia interactiva ${currentStep + 1} de ${steps.length}`;
      byId("catalogGuideTitle").textContent = step.title;
      byId("catalogGuideText").textContent = step.text;
      byId("catalogGuidePrev").disabled = currentStep === 0;
      byId("catalogGuideNext").textContent = currentStep === steps.length - 1 ? "Finalizar" : "Siguiente";
      renderGuideProgress();
      highlightGuideTarget(step);
      guide.classList.add("is-active");
      scheduleSpotlightUpdate();

      if (automatic) {
        trackCatalogEvent("guide_auto_opened", { metadata: { guide_version: "v1" } });
      }
    }

    function hideGuide(remember) {
      byId("catalogGuide")?.classList.remove("is-active");
      clearGuideTarget();
      if (remember) markGuideSeen(seenKey);
    }

    function renderGuideProgress() {
      const progress = byId("catalogGuideProgress");
      if (!progress) return;
      progress.innerHTML = "";
      steps.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = `catalog-guide-dot${index === currentStep ? " is-active" : ""}`;
        progress.appendChild(dot);
      });
    }

    function clearGuideTarget() {
      if (activeTarget) activeTarget.classList.remove("catalog-guide-highlight");
      activeTarget = null;
      window.clearTimeout(spotlightTimer);
      spotlight.style.display = "none";
    }

    function isCompactGuideViewport() {
      return window.matchMedia && window.matchMedia("(max-width: 920px)").matches;
    }

    function scheduleSpotlightUpdate() {
      window.clearTimeout(spotlightTimer);
      spotlightTimer = window.setTimeout(updateSpotlight, 80);
      window.requestAnimationFrame?.(() => window.requestAnimationFrame?.(updateSpotlight));
    }

    function highlightGuideTarget(step) {
      clearGuideTarget();
      const selector = isCompactGuideViewport() && step.compactSelector ? step.compactSelector : step.selector;
      const target = resolveGuideTarget(selector, step);
      if (!target) return;
      activeTarget = target;
      if (step.rememberProductCard) {
        activeGuideProductCard = target.closest(".product-card") || target;
      }
      activeTarget.classList.add("catalog-guide-highlight");
      activeTarget.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
      window.setTimeout(() => scrollGuideTargetIntoSafeArea(activeTarget), 120);
      window.setTimeout(() => settleGuideTarget(activeTarget), 220);
      window.setTimeout(() => settleGuideTarget(activeTarget), 520);
      window.setTimeout(() => settleGuideTarget(activeTarget), 860);
    }

    function resolveGuideTarget(selector, step = {}) {
      if (step.withinProductCard && activeGuideProductCard) {
        const localTarget = resolveGuideTargetWithin(activeGuideProductCard, selector);
        if (localTarget) return localTarget;
      }
      const selectors = String(selector || "").split(",").map((item) => item.trim()).filter(Boolean);
      for (const item of selectors) {
        const candidates = Array.from(document.querySelectorAll(item));
        const visible = candidates.find(isUsableGuideTarget);
        if (visible) return visible;
      }
      return null;
    }

    function resolveGuideTargetWithin(root, selector) {
      const selectors = String(selector || "").split(",").map((item) => item.trim()).filter(Boolean);
      for (const item of selectors) {
        const candidates = Array.from(root.querySelectorAll(item));
        const visible = candidates.find(isUsableGuideTarget);
        if (visible) return visible;
      }
      return null;
    }

    function isUsableGuideTarget(element) {
      if (!element || !(element instanceof Element)) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const rect = element.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) return false;
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      if (rect.width > viewportWidth * 0.98 && rect.height > viewportHeight * 0.72) return false;
      if (isCompactGuideViewport() && rect.height > viewportHeight * 0.48) return false;
      return true;
    }

    function clampNumber(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function settleGuideTarget(target) {
      if (!target || target !== activeTarget || !byId("catalogGuide")?.classList.contains("is-active")) return;
      scrollGuideTargetIntoSafeArea(target);
      updateSpotlight();
    }

    function scrollGuideTargetIntoSafeArea(target) {
      const rect = target.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport ? viewport.offsetTop : 0;
      const viewportHeight = viewport ? viewport.height : window.innerHeight;
      const guideCard = byId("catalogGuide")?.querySelector(".catalog-guide-card");
      const guideRect = guideCard ? guideCard.getBoundingClientRect() : null;
      const safeTop = viewportTop + 12;
      const safeBottom = guideRect
        ? Math.max(safeTop + 84, guideRect.top - 16)
        : viewportTop + viewportHeight - 18;
      const safeHeight = Math.max(80, safeBottom - safeTop);
      const targetHeight = Math.min(rect.height, safeHeight);
      const desiredTop = safeTop + Math.max(8, (safeHeight - targetHeight) * 0.32);
      const fullyVisible = rect.top >= safeTop && rect.bottom <= safeBottom;
      const delta = fullyVisible ? 0 : rect.top - desiredTop;
      if (Math.abs(delta) > 2) {
        window.scrollBy({ top: delta, left: 0, behavior: "auto" });
      }
    }

    function updateSpotlight() {
      if (!activeTarget || !byId("catalogGuide")?.classList.contains("is-active")) return;
      const rect = activeTarget.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport ? viewport.offsetTop : 0;
      const viewportLeft = viewport ? viewport.offsetLeft : 0;
      const viewportWidth = viewport ? viewport.width : window.innerWidth;
      const viewportHeight = viewport ? viewport.height : window.innerHeight;
      const compact = isCompactGuideViewport();
      const padding = compact ? 5 : 8;
      const minTop = viewportTop + (compact ? 10 : 8);
      const minLeft = viewportLeft + (compact ? 10 : 8);
      const maxWidth = Math.max(0, viewportWidth - (compact ? 20 : 16));
      const maxHeight = Math.max(0, viewportHeight - (compact ? 170 : 16));
      const rawTop = rect.top + viewportTop - padding;
      const rawLeft = rect.left + viewportLeft - padding;
      const width = Math.min(Math.max(0, rect.width + padding * 2), maxWidth);
      const height = Math.min(Math.max(0, rect.height + padding * 2), maxHeight);
      const maxTop = Math.max(minTop, viewportTop + viewportHeight - height - (compact ? 150 : 8));
      const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - width - (compact ? 10 : 8));
      const top = clampNumber(rawTop, minTop, maxTop);
      const left = clampNumber(rawLeft, minLeft, maxLeft);

      if (width < 24 || height < 24 || rect.bottom < 0 || rect.top > viewportHeight) {
        spotlight.style.display = "none";
        return;
      }

      spotlight.style.display = "block";
      spotlight.style.top = `${top}px`;
      spotlight.style.left = `${left}px`;
      spotlight.style.width = `${width}px`;
      spotlight.style.height = `${height}px`;
    }
  }

  function hasSeenGuide(key) {
    try {
      return localStorage.getItem(key) === "1";
    } catch (error) {
      return true;
    }
  }

  function markGuideSeen(key) {
    try {
      localStorage.setItem(key, "1");
    } catch (error) {
    }
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

  function cssAttributeEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value || ""));
    }
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
})();

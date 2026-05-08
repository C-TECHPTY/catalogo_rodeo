const fs = require('fs/promises');
const path = require('path');

const cache = {
  loadedAt: 0,
  products: [],
  source: '',
};

async function findProductByItem(itemCode) {
  const products = await loadProducts();
  const target = normalizeItem(itemCode);

  return products.find((product) => {
    const item = normalizeItem(product.item || product.item_code || product.sku || '');
    return item === target;
  }) || null;
}

async function catalogInfo() {
  const source = (process.env.CATALOG_JSON_SOURCE || '').trim();
  if (source === '') {
    return {
      title: '',
      slug: '',
      publicUrl: '',
    };
  }

  const payload = await loadCatalogPayload(source);
  return {
    title: firstText([
      payload.title,
      payload.catalog && payload.catalog.title,
      payload.catalog && payload.catalog.metadata && payload.catalog.metadata.title,
    ]),
    slug: firstText([
      payload.slug,
      payload.catalog && payload.catalog.slug,
      payload.catalog && payload.catalog.metadata && payload.catalog.metadata.slug,
    ]),
    publicUrl: firstText([
      payload.public_url,
      payload.publicUrl,
      payload.catalog && payload.catalog.public_url,
      payload.catalog && payload.catalog.publicUrl,
      payload.catalog && payload.catalog.metadata && payload.catalog.metadata.public_url,
      payload.catalog && payload.catalog.metadata && payload.catalog.metadata.publicUrl,
    ]),
  };
}

async function catalogCategories() {
  const products = await loadProducts();
  const categories = new Set();

  for (const product of products) {
    const category = firstText([
      product.category,
      product.categoria,
      product.media && product.media.category,
    ]);

    if (category !== '') {
      categories.add(category);
    }
  }

  return Array.from(categories).sort((a, b) => a.localeCompare(b, 'es'));
}

async function loadProducts() {
  const source = (process.env.CATALOG_JSON_SOURCE || '').trim();
  if (source === '') {
    return [];
  }

  const ttlMs = Math.max(10, Number(process.env.CATALOG_CACHE_SECONDS || 60)) * 1000;
  const now = Date.now();
  if (cache.source === source && cache.products.length > 0 && now - cache.loadedAt < ttlMs) {
    return cache.products;
  }

  const payload = await loadCatalogPayload(source);
  const products = extractProducts(payload);
  const baseUrl = resolveCatalogBaseUrl(payload, source);
  const enrichedProducts = products.map((product) => ({
    ...product,
    __catalogBaseUrl: baseUrl,
  }));

  cache.source = source;
  cache.products = enrichedProducts;
  cache.loadedAt = now;

  return enrichedProducts;
}

async function loadCatalogPayload(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`No se pudo leer catalogo remoto: HTTP ${response.status}`);
    }
    return response.json();
  }

  const fullPath = path.resolve(process.cwd(), source);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

function extractProducts(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidates = [
    payload.catalog,
    payload.products,
    payload.items,
    payload.catalog && payload.catalog.catalog,
    payload.catalog && payload.catalog.products,
    payload.catalog && payload.catalog.items,
    payload.catalog && payload.catalog.metadata && payload.catalog.metadata.catalog,
    payload.catalog && payload.catalog.metadata && payload.catalog.metadata.products,
    payload.catalog && payload.catalog.metadata && payload.catalog.metadata.items,
    payload.data && payload.data.catalog,
    payload.data && payload.data.products,
    payload.metadata && payload.metadata.catalog,
  ];

  const list = candidates.find(Array.isArray);
  return Array.isArray(list) ? list.filter((item) => item && typeof item === 'object') : [];
}

function resolveCatalogBaseUrl(payload, source) {
  const publicUrl = firstText([
    payload && payload.public_url,
    payload && payload.publicUrl,
    payload && payload.catalog && payload.catalog.public_url,
    payload && payload.catalog && payload.catalog.publicUrl,
    payload && payload.catalog && payload.catalog.metadata && payload.catalog.metadata.public_url,
    payload && payload.catalog && payload.catalog.metadata && payload.catalog.metadata.publicUrl,
  ]);

  if (publicUrl !== '') {
    return ensureTrailingSlash(publicUrl);
  }

  if (/^https?:\/\//i.test(source)) {
    return ensureTrailingSlash(source.replace(/\/[^/?#]+(?:[?#].*)?$/, '/'));
  }

  return '';
}

function normalizeItem(value) {
  return String(value || '').trim().toUpperCase();
}

function productPrice(product) {
  return firstText([
    product.price,
    product.unit_price,
    product.regular_price,
    product.media && product.media.price,
  ]);
}

function productAvailable(product) {
  return firstText([
    product.available,
    product.stock,
    product.disponible,
    product.quantity_available,
    product.media && product.media.available,
  ]);
}

function productDescription(product) {
  return firstText([
    product.description,
    product.shortDescription,
    product.short_description,
    product.name,
  ]);
}

function productImageUrl(product) {
  const image = firstText([
    product.image_url,
    product.imageUrl,
    product.main_image,
    product.mainImage,
    product.media && product.media.mainImage,
    product.media && product.media.main_image,
    product.media && Array.isArray(product.media.gallery) && product.media.gallery[0],
    Array.isArray(product.gallery) && product.gallery[0],
  ]);

  if (image === '') {
    return '';
  }

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  const baseUrl = product.__catalogBaseUrl || '';
  if (baseUrl === '') {
    return '';
  }

  return new URL(image.replace(/^\.\//, ''), baseUrl).toString();
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function firstText(values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text !== '') {
      return text;
    }
  }

  return '';
}

module.exports = {
  catalogCategories,
  catalogInfo,
  findProductByItem,
  productAvailable,
  productDescription,
  productImageUrl,
  productPrice,
};

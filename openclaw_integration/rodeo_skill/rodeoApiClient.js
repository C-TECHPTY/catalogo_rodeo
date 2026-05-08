const { assertAllowed, logAction } = require('../guard');

const apiBaseUrl = (process.env.RODEO_API_BASE_URL || '').replace(/\/+$/, '');
const apiKey = process.env.RODEO_AI_API_KEY || '';
const mockMode = String(process.env.RODEO_MOCK_MODE || 'false').toLowerCase() === 'true';

async function callRodeoApi(action, path, payload = {}) {
  const endpoint = {
    method: 'POST',
    path,
  };

  assertAllowed(action, endpoint);
  logAction(action, payload, mockMode ? 'mock-started' : 'started');

  if (mockMode) {
    const data = mockResponse(action, payload);
    logAction(action, data, 'mock-ok');
    return data;
  }

  if (apiBaseUrl === '') {
    throw new Error('RODEO_API_BASE_URL is required');
  }

  if (apiKey === '') {
    throw new Error('RODEO_AI_API_KEY is required');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Rodeo-AI-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  logAction(action, { status: response.status, ok: response.ok }, response.ok ? 'ok' : 'error');

  if (!response.ok) {
    throw new Error(data.error || `Rodeo API error ${response.status}`);
  }

  return data;
}

function checkSeller(payload) {
  return callRodeoApi('auth.checkSeller', '/catalogos_api/whatsapp_auth_check.php', payload);
}

function queryPrice(payload) {
  return callRodeoApi('product.queryPrice', '/catalogos_api/whatsapp_product_query.php', {
    ...payload,
    query: 'price',
  });
}

function queryStock(payload) {
  return callRodeoApi('product.queryStock', '/catalogos_api/whatsapp_product_query.php', {
    ...payload,
    query: 'stock',
  });
}

function queryImage(payload) {
  return callRodeoApi('product.queryImage', '/catalogos_api/whatsapp_product_query.php', {
    ...payload,
    query: 'image',
  });
}

function requestCatalog(payload) {
  return callRodeoApi('catalog.requestByCategory', '/catalogos_api/ai_create_catalog_request.php', payload);
}

function requestStatus(payload) {
  return callRodeoApi('catalog.status', '/catalogos_api/ai_request_status.php', payload);
}

function createDraftOrder(payload) {
  return callRodeoApi('order.createDraft', '/catalogos_api/ai_create_catalog_request.php', {
    ...payload,
    draft_only: true,
  });
}

function sendWhatsAppCatalogLink(payload) {
  return callRodeoApi('seller.sendWhatsAppCatalogLink', '/catalogos_api/ai_create_catalog_request.php', {
    ...payload,
    channel: 'whatsapp',
  });
}

function sendEmailCatalogLink(payload) {
  return callRodeoApi('seller.sendEmailCatalogLink', '/catalogos_api/ai_create_catalog_request.php', {
    ...payload,
    channel: 'email',
  });
}

function mockResponse(action, payload) {
  if (action === 'auth.checkSeller') {
    return {
      ok: true,
      authorized: true,
      seller: {
        id: 1,
        name: 'Vendedor Demo',
        phone: payload.sender || 'demo',
      },
    };
  }

  if (action === 'product.queryPrice') {
    return {
      ok: true,
      item: payload.item,
      price: 'USD 8.24',
      description: 'Producto demo para prueba local',
    };
  }

  if (action === 'product.queryStock') {
    return {
      ok: true,
      item: payload.item,
      stock: 99,
      description: 'Producto demo para prueba local',
    };
  }

  if (action === 'product.queryImage') {
    return {
      ok: true,
      item: payload.item,
      image_url: 'https://rodeoimportzl.com/catalogos/nueva-entrada/',
    };
  }

  if (action === 'catalog.requestByCategory') {
    return {
      ok: true,
      category: payload.category,
      public_url: 'https://rodeoimportzl.com/catalogos/nueva-entrada/',
      status: 'ready',
    };
  }

  if (action === 'catalog.status') {
    return {
      ok: true,
      request_id: payload.request_id,
      status: 'ready',
    };
  }

  if (action === 'seller.sendWhatsAppCatalogLink' || action === 'seller.sendEmailCatalogLink') {
    return {
      ok: true,
      sent: true,
      channel: payload.channel,
      public_url: 'https://rodeoimportzl.com/catalogos/nueva-entrada/',
    };
  }

  if (action === 'order.createDraft') {
    return {
      ok: true,
      draft: true,
      draft_id: 'DRAFT-DEMO-001',
    };
  }

  return {
    ok: false,
    error: `No mock implemented for ${action}`,
  };
}

module.exports = {
  callRodeoApi,
  checkSeller,
  createDraftOrder,
  queryImage,
  queryPrice,
  queryStock,
  requestCatalog,
  requestStatus,
  sendEmailCatalogLink,
  sendWhatsAppCatalogLink,
};

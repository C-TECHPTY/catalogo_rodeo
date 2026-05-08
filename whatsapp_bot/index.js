require('dotenv').config();

const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const {
  catalogCategories,
  catalogInfo,
  findProductByItem,
  productAvailable,
  productDescription,
  productImageUrl,
  productPrice,
} = require('./src/catalog-data');
const {
  addItem,
  cartTotals,
  clearCart,
  getCart,
  getCustomer,
  setCustomerField,
} = require('./src/cart-store');
const { findSellerByPhone } = require('./src/sellers');

const botName = process.env.BOT_NAME || 'Rodeo WhatsApp Bot';
const currency = process.env.CURRENCY || 'USD';
const authorizedNumbers = new Set(
  (process.env.AUTHORIZED_NUMBERS || '')
    .split(',')
    .map((number) => normalizePhone(number))
    .filter(Boolean)
);

const noSandbox = String(process.env.PUPPETEER_NO_SANDBOX || 'true').toLowerCase() === 'true';
const chromePath = resolveBrowserPath((process.env.CHROME_PATH || '').trim());
const puppeteerOptions = {
  headless: true,
  args: [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    ...(noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ],
};

if (chromePath !== '') {
  puppeteerOptions.executablePath = chromePath;
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'rodeo-commercial-assistant',
  }),
  puppeteer: puppeteerOptions,
});

client.on('qr', (qr) => {
  console.log('\nEscanea este QR con WhatsApp > Dispositivos vinculados:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log(`${botName} listo.`);
  console.log(`Numeros autorizados: ${authorizedNumbers.size}`);
});

client.on('auth_failure', (message) => {
  console.error('Fallo de autenticacion de WhatsApp:', message);
});

client.on('disconnected', (reason) => {
  console.warn('WhatsApp desconectado:', reason);
});

client.on('message', async (message) => {
  const contact = await message.getContact();
  const sender = resolveSenderNumber(message, contact);
  const text = (message.body || '').trim();

  if (!isAuthorized(sender)) {
    console.log(`Mensaje ignorado de numero no autorizado: ${sender || message.from}`);
    console.log(`Remitente WhatsApp: from=${message.from} number=${contact.number || ''} pushname=${contact.pushname || contact.name || ''}`);
    return;
  }

  const responses = await buildResponses(text, sender);
  if (responses.length === 0) {
    return;
  }

  for (const response of responses) {
    await sendBotResponse(message, response);
  }
});

function normalizePhone(value) {
  return String(value || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D+/g, '');
}

function resolveSenderNumber(message, contact) {
  const candidates = [
    contact && contact.number,
    contact && contact.id && contact.id.user,
    message.author,
    message.from,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePhone(candidate);
    if (normalized !== '') {
      return normalized;
    }
  }

  return '';
}

function resolveBrowserPath(configuredPath) {
  if (configuredPath !== '' && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function isAuthorized(sender) {
  return sender !== '' && authorizedNumbers.has(sender);
}

async function buildResponses(text, sender) {
  const commands = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (commands.length <= 1) {
    return [await buildResponse(text, sender)].filter(Boolean);
  }

  const responses = [];
  for (const command of commands) {
    responses.push(await buildResponse(command, sender));
  }

  return responses.filter(Boolean);
}

async function buildResponse(text, sender) {
  if (isHelpCommand(text)) {
    return buildHelpResponse();
  }

  if (isCategoriesCommand(text)) {
    return buildCategoriesResponse();
  }

  const parsed = parseCommand(text);

  if (!parsed) {
    return [
      'Comando no reconocido.',
      '',
      'Comandos disponibles:',
      '- ayuda',
      '- categorias',
      '- precio ITEM',
      '- stock ITEM',
      '- foto ITEM',
      '- catalogo CATEGORIA',
      '- agregar ITEM CANTIDAD',
      '- carrito',
      '- confirmar',
      '- cliente NOMBRE',
      '- email CORREO',
      '- telefono NUMERO',
      '- vaciar',
    ].join('\n');
  }

  if (parsed.command === 'precio') {
    return buildPriceResponse(parsed.value);
  }

  if (parsed.command === 'stock') {
    return buildStockResponse(parsed.value);
  }

  if (parsed.command === 'foto') {
    return buildPhotoResponse(parsed.value);
  }

  if (parsed.command === 'catalogo') {
    return buildCatalogResponse(parsed.value, sender);
  }

  if (parsed.command === 'agregar') {
    return buildAddToCartResponse(sender, parsed.value);
  }

  if (parsed.command === 'carrito') {
    return buildCartResponse(sender);
  }

  if (parsed.command === 'confirmar') {
    return buildConfirmDraftResponse(sender);
  }

  if (parsed.command === 'cliente') {
    const customer = setCustomerField(sender, 'name', parsed.value);
    return `Cliente registrado para este borrador: ${customer.name}`;
  }

  if (parsed.command === 'email') {
    const customer = setCustomerField(sender, 'email', parsed.value);
    return `Email registrado para este borrador: ${customer.email}`;
  }

  if (parsed.command === 'telefono') {
    const customer = setCustomerField(sender, 'phone', parsed.value);
    return `Telefono registrado para este borrador: ${customer.phone}`;
  }

  if (parsed.command === 'vaciar') {
    clearCart(sender);
    return 'Carrito temporal vaciado.';
  }

  return null;
}

function buildHelpResponse() {
  return [
    'Asistente comercial Rodeo',
    '',
    'Comandos disponibles:',
    '- precio ITEM',
    '- stock ITEM',
    '- foto ITEM',
    '- catalogo CATEGORIA',
    '- agregar ITEM CANTIDAD',
    '- carrito',
    '- confirmar',
    '- cliente NOMBRE',
    '- email CORREO',
    '- telefono NUMERO',
    '- vaciar',
    '- categorias',
    '',
    'Ejemplos:',
    'precio 100-9652',
    'stock 100-9652',
    'foto 100-9652',
    'catalogo nueva entrada',
    'agregar 100-9652 2',
    'carrito',
    'cliente Almacen Central',
    'email cliente@empresa.com',
    'telefono 50760000000',
    'confirmar',
  ].join('\n');
}

async function buildCategoriesResponse() {
  try {
    const categories = await catalogCategories();
    if (categories.length === 0) {
      return 'No encontre categorias en el catalogo configurado.';
    }

    return [
      'Categorias disponibles:',
      ...categories.slice(0, 25).map((category) => `- ${category}`),
      categories.length > 25 ? `...y ${categories.length - 25} mas.` : '',
    ].filter(Boolean).join('\n');
  } catch (error) {
    console.error('Error leyendo categorias:', error.message);
    return 'No pude leer las categorias del catalogo en este momento.';
  }
}

async function buildCatalogResponse(category, sender) {
  try {
    const info = await catalogInfo();
    if (!info.publicUrl) {
      return 'No hay link de catalogo configurado para enviar.';
    }

    const seller = await safeFindSeller(sender);
    const sellerToken = seller && seller.public_token ? seller.public_token : '';
    const url = appendSellerToken(info.publicUrl, sellerToken);

    return [
      `Catalogo solicitado: ${category}`,
      info.title ? `Catalogo activo: ${info.title}` : '',
      seller && seller.name ? `Vendedor: ${seller.name}` : '',
      `Link: ${url}`,
    ].filter(Boolean).join('\n');
  } catch (error) {
    console.error('Error preparando link de catalogo:', error.message);
    return 'No pude preparar el link del catalogo en este momento.';
  }
}

async function safeFindSeller(sender) {
  try {
    return await findSellerByPhone(sender);
  } catch (error) {
    console.error('Error buscando vendedor:', error.message);
    return null;
  }
}

function appendSellerToken(publicUrl, sellerToken = '') {
  const token = sellerToken || (process.env.DEFAULT_SELLER_TOKEN || '').trim();
  if (token === '') {
    return publicUrl;
  }

  const url = new URL(publicUrl);
  url.searchParams.set('t', token);
  return url.toString();
}

async function sendBotResponse(message, response) {
  if (typeof response === 'string') {
    await message.reply(response);
    return;
  }

  if (response.text) {
    await message.reply(response.text);
  }

  if (response.mediaUrl) {
    try {
      const media = await MessageMedia.fromUrl(response.mediaUrl, { unsafeMime: true });
      await client.sendMessage(message.from, media, { caption: response.caption || '' });
    } catch (error) {
      console.error('No se pudo enviar imagen:', error.message);
      await message.reply('Encontre imagen del producto, pero no pude enviarla por WhatsApp en este momento.');
    }
  }
}

async function buildPriceResponse(itemCode) {
  const product = await safeFindProduct(itemCode);
  if (!product) {
    return `No encontre el item ${itemCode} en el catalogo configurado.`;
  }

  const price = productPrice(product) || 'No definido';
  const description = productDescription(product);

  return [
    `Item ${itemCode}`,
    description ? `Producto: ${description}` : '',
    `Precio: ${price}`,
  ].filter(Boolean).join('\n');
}

async function buildStockResponse(itemCode) {
  const product = await safeFindProduct(itemCode);
  if (!product) {
    return `No encontre el item ${itemCode} en el catalogo configurado.`;
  }

  const available = productAvailable(product) || 'No definido';
  const description = productDescription(product);

  return [
    `Item ${itemCode}`,
    description ? `Producto: ${description}` : '',
    `Disponibilidad: ${available}`,
  ].filter(Boolean).join('\n');
}

async function buildPhotoResponse(itemCode) {
  const product = await safeFindProduct(itemCode);
  if (!product) {
    return `No encontre el item ${itemCode} en el catalogo configurado.`;
  }

  const imageUrl = productImageUrl(product);
  if (imageUrl === '') {
    return `No encontre imagen disponible para el item ${itemCode}.`;
  }

  const description = productDescription(product);
  return {
    text: `Imagen encontrada para el item ${itemCode}.`,
    mediaUrl: imageUrl,
    caption: [
      `Item ${itemCode}`,
      description ? `Producto: ${description}` : '',
    ].filter(Boolean).join('\n'),
  };
}

async function buildAddToCartResponse(sender, value) {
  const parts = value.trim().split(/\s+/);
  const quantityCandidate = parts[parts.length - 1];
  const hasQuantity = /^\d+$/.test(quantityCandidate);
  const quantity = hasQuantity ? Number(quantityCandidate) : 1;
  const itemCode = hasQuantity ? parts.slice(0, -1).join(' ') : value.trim();

  if (itemCode === '') {
    return 'Usa: agregar ITEM CANTIDAD. Ejemplo: agregar 100-9652 2';
  }

  const product = await safeFindProduct(itemCode);
  if (!product) {
    return `No encontre el item ${itemCode} en el catalogo configurado.`;
  }

  const cart = addItem(sender, product, quantity);
  const description = productDescription(product);

  return [
    `Agregado al carrito temporal: ${itemCode}`,
    description ? `Producto: ${description}` : '',
    `Cantidad: ${quantity}`,
    `Lineas en carrito: ${cart.length}`,
    '',
    'Este carrito es de prueba. Aun no crea pedidos reales.',
  ].filter(Boolean).join('\n');
}

function buildCartResponse(sender) {
  const cart = getCart(sender);
  if (cart.length === 0) {
    return 'Tu carrito temporal esta vacio.';
  }

  return [
    'Carrito temporal:',
    ...cart.map((item, index) => formatCartLine(item, index)),
    '',
    `Subtotal estimado: ${formatMoney(cartTotals(sender).subtotal)}`,
    '',
    'Para limpiar: vaciar',
    'Este carrito aun no genera pedidos reales.',
  ].join('\n');
}

function buildConfirmDraftResponse(sender) {
  const cart = getCart(sender);
  if (cart.length === 0) {
    return 'No hay productos en el carrito temporal para confirmar.';
  }

  const totals = cartTotals(sender);
  const customer = getCustomer(sender);
  return [
    'Resumen de pedido temporal',
    '',
    'Cliente:',
    `Nombre: ${customer.name || 'No definido'}`,
    `Email: ${customer.email || 'No definido'}`,
    `Telefono: ${customer.phone || 'No definido'}`,
    '',
    'Productos:',
    ...cart.map((item, index) => formatCartLine(item, index)),
    '',
    `Lineas: ${totals.lines}`,
    `Piezas/unidades solicitadas: ${totals.totalQuantity}`,
    `Subtotal estimado: ${formatMoney(totals.subtotal)}`,
    '',
    'Este resumen aun NO fue enviado como pedido real.',
    'Siguiente fase: enviar este borrador a la API de pedidos con confirmacion segura.',
  ].join('\n');
}

async function safeFindProduct(itemCode) {
  try {
    return await findProductByItem(itemCode);
  } catch (error) {
    console.error('Error leyendo catalogo:', error.message);
    return null;
  }
}

function parseCommand(text) {
  if (/^(carrito|confirmar|vaciar)$/i.test(text.trim())) {
    return {
      command: text.trim().toLowerCase(),
      value: '',
    };
  }

  const match = text.match(/^(precio|stock|foto|catalogo|agregar|cliente|email|telefono)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    command: match[1].toLowerCase(),
    value: match[2].trim(),
  };
}

function isHelpCommand(text) {
  return /^(ayuda|help|menu|menú)$/i.test(text.trim());
}

function isCategoriesCommand(text) {
  return /^(categorias|categorías|categoria|categoría)$/i.test(text.trim());
}

function formatCartLine(item, index) {
  const subtotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
  return `${index + 1}. ${item.itemCode} x ${item.quantity}${item.price ? ` | ${item.price}` : ''}${subtotal > 0 ? ` | Subtotal ${formatMoney(subtotal)}` : ''}`;
}

function formatMoney(value) {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

client.initialize();

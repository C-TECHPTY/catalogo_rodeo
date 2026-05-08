require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const {
  checkSeller,
  createDraftOrder,
  queryImage,
  queryPrice,
  queryStock,
  requestCatalog,
  requestStatus,
  sendEmailCatalogLink,
  sendWhatsAppCatalogLink,
} = require('./rodeo_skill/rodeoApiClient');

const sender = process.env.RODEO_TEST_SENDER || '50762070678';

async function main() {
  const input = process.argv.slice(2).join(' ').trim();
  if (input === '') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const parsed = parseIntent(input);
  if (!parsed.allowed) {
    console.log(`Bloqueado: ${parsed.reason}`);
    return;
  }

  const auth = await checkSeller({ sender });
  if (!auth.authorized) {
    console.log('Bloqueado: vendedor no autorizado.');
    return;
  }

  const response = await executeIntent(parsed);
  console.log(formatResponse(parsed, response));
}

function parseIntent(input) {
  const text = input.trim();
  const match = text.match(/^RODE\s+(.+)$/i);
  if (!match) {
    return deny('El comando debe empezar con RODE.');
  }

  const command = match[1].trim();
  const itemMatch = command.match(/^(precio|stock|imagen)\s+(.+)$/i);
  if (itemMatch) {
    const type = itemMatch[1].toLowerCase();
    return {
      allowed: true,
      type,
      item: itemMatch[2].trim(),
    };
  }

  const catalogMatch = command.match(/^(catalogo|catálogo)\s+(.+)$/i);
  if (catalogMatch) {
    return {
      allowed: true,
      type: 'catalogo',
      category: catalogMatch[2].trim(),
    };
  }

  const statusMatch = command.match(/^estado\s+(.+)$/i);
  if (statusMatch) {
    return {
      allowed: true,
      type: 'estado',
      requestId: statusMatch[1].trim(),
    };
  }

  if (/^env[ií]alo a mi whatsapp$/i.test(command)) {
    return {
      allowed: true,
      type: 'send_whatsapp',
    };
  }

  if (/^env[ií]alo a mi correo$/i.test(command)) {
    return {
      allowed: true,
      type: 'send_email',
    };
  }

  const draftMatch = command.match(/^borrador\s+(.+)$/i);
  if (draftMatch) {
    return {
      allowed: true,
      type: 'draft',
      notes: draftMatch[1].trim(),
    };
  }

  return deny('Accion fuera de permisos de RODE IA.');
}

function deny(reason) {
  return {
    allowed: false,
    reason,
  };
}

async function executeIntent(intent) {
  if (intent.type === 'precio') {
    return queryPrice({ sender, item: intent.item });
  }

  if (intent.type === 'stock') {
    return queryStock({ sender, item: intent.item });
  }

  if (intent.type === 'imagen') {
    return queryImage({ sender, item: intent.item });
  }

  if (intent.type === 'catalogo') {
    return requestCatalog({ sender, category: intent.category });
  }

  if (intent.type === 'estado') {
    return requestStatus({ sender, request_id: intent.requestId });
  }

  if (intent.type === 'send_whatsapp') {
    return sendWhatsAppCatalogLink({ sender });
  }

  if (intent.type === 'send_email') {
    return sendEmailCatalogLink({ sender });
  }

  if (intent.type === 'draft') {
    return createDraftOrder({ sender, notes: intent.notes });
  }

  throw new Error(`Intent not implemented: ${intent.type}`);
}

function formatResponse(intent, response) {
  return JSON.stringify({
    intent,
    response,
  }, null, 2);
}

function printUsage() {
  console.log('Uso:');
  console.log('  node openclaw_integration/test_local.js "RODE precio 100-9652"');
  console.log('  node openclaw_integration/test_local.js "RODE stock 100-9652"');
  console.log('  node openclaw_integration/test_local.js "RODE catalogo vasos"');
  console.log('  node openclaw_integration/test_local.js "RODE envialo a mi correo"');
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

# Rodeo WhatsApp Bot

Bot de prueba para la Fase 1 del asistente comercial por WhatsApp.

Esta fase usa `whatsapp-web.js` con WhatsApp Web personal. No consulta base de datos, no toca Electron, no toca hosting y no crea pedidos reales.

Fase 2 agrega consulta de precio y disponibilidad desde un JSON de catalogo en modo solo lectura. No usa MySQL y no modifica ningun dato.

## Requisitos

- Node.js 18 o superior.
- Una cuenta de WhatsApp para vincular como dispositivo.
- Numeros autorizados definidos en `.env`.

## Instalacion

```bash
cd whatsapp_bot
npm install
```

Si `npm install` falla descargando `chrome-headless-shell` o Chromium en Windows, usa Chrome instalado y salta esa descarga:

```powershell
$env:PUPPETEER_SKIP_DOWNLOAD="true"
npm install
```

## Configuracion

Copiar el ejemplo:

```bash
copy .env.example .env
```

En macOS/Linux:

```bash
cp .env.example .env
```

Editar `.env`:

```text
BOT_NAME=Rodeo WhatsApp Bot
CURRENCY=USD
AUTHORIZED_NUMBERS=50760000000,50761111111
PUPPETEER_NO_SANDBOX=true
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
CATALOG_JSON_SOURCE=https://rodeoimportzl.com/catalogos_api/public_catalog.php?slug=nueva-entrada
CATALOG_CACHE_SECONDS=60
DEFAULT_SELLER_TOKEN=
DB_HOST=
DB_PORT=3306
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_CONNECTION_LIMIT=3
```

Los numeros deben ir en formato internacional, sin `+`, espacios ni guiones.

Si Chrome esta instalado en otra ruta, ajusta `CHROME_PATH`. Rutas comunes en Windows:

```text
C:\Program Files\Google\Chrome\Application\chrome.exe
C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
```

Si `CHROME_PATH` queda vacio, el bot intenta detectar automaticamente Chrome o Edge en Windows.

Si el primer `npm install` fallo descargando Chromium, limpia la instalacion parcial antes de intentar de nuevo:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
$env:PUPPETEER_SKIP_DOWNLOAD="true"
npm install
```

## Ejecutar

```bash
npm start
```

Al iniciar, la terminal muestra un QR. Escanearlo desde:

```text
WhatsApp > Dispositivos vinculados > Vincular un dispositivo
```

## Comandos De Prueba

Desde un numero autorizado:

```text
precio 100-9652
```

Respuesta esperada:

```text
Item 100-9652
Producto: ...
Precio: ...
```

Otros comandos:

```text
ayuda
categorias
stock 100-9652
foto 100-9652
catalogo plasticos
agregar 100-9652 2
carrito
cliente Almacen Central
email cliente@empresa.com
telefono 50760000000
confirmar
vaciar
```

`ayuda` muestra el menu de comandos.
`categorias` lista las categorias encontradas en el catalogo configurado.
`precio ITEM` y `stock ITEM` consultan `CATALOG_JSON_SOURCE`. Si el item no existe, el bot avisa que no lo encontro.
`foto ITEM` intenta enviar la imagen principal del producto si existe.
`catalogo CATEGORIA` devuelve el link publico del catalogo configurado. Si la conexion MySQL esta configurada, busca el vendedor activo por telefono y usa `sellers.public_token`. Si no hay conexion o no encuentra vendedor, usa `DEFAULT_SELLER_TOKEN` cuando exista.
`cliente`, `email` y `telefono` agregan datos al borrador temporal. `agregar ITEM CANTIDAD`, `carrito`, `confirmar` y `vaciar` trabajan con un carrito temporal en memoria. No crean pedidos reales.

Tambien puedes enviar varios comandos en un solo mensaje, uno por linea:

```text
cliente Almacen Central
email cliente@empresa.com
telefono 50760000000
agregar 100-9652 2
confirmar
```

Para un catalogo publicado en:

```text
https://rodeoimportzl.com/catalogos/nueva-entrada/
```

puedes usar:

```text
CATALOG_JSON_SOURCE=https://rodeoimportzl.com/catalogos_api/public_catalog.php?slug=nueva-entrada
```

## Seguridad De Esta Fase

- Solo responde a numeros incluidos en `AUTHORIZED_NUMBERS`.
- Las respuestas son simuladas.
- En Fase 2, precio y stock leen solo el JSON configurado en `CATALOG_JSON_SOURCE`.
- En Fase 3, `foto ITEM` envia una imagen del producto si el catalogo incluye URL de imagen.
- En Fase 4, `catalogo CATEGORIA` envia el link publico del catalogo configurado.
- En Fase 5, la conexion MySQL es opcional y solo lectura para resolver vendedor por telefono.
- En Fase 6, el carrito es temporal en memoria y se pierde al reiniciar el bot.
- En Fase 7, `confirmar` genera solo un resumen/borrador. No envia pedidos reales.
- En Fase 8, los datos de cliente se guardan solo en memoria para completar el borrador.
- En Fase 9, el bot puede procesar varios comandos en un solo mensaje, uno por linea.
- En Fase 10, el carrito temporal muestra subtotal estimado usando precios del catalogo.
- No se modifican pedidos, vendedores, campanas ni links seguros.

## Sesion De WhatsApp

`whatsapp-web.js` crea una sesion local para no pedir QR en cada inicio. Si necesitas forzar un nuevo QR, detén el bot y elimina la carpeta local `.wwebjs_auth` creada dentro de `whatsapp_bot/`.

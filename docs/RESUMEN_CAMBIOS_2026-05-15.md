# Resumen de cambios - 2026-05-15

Este documento resume las fases implementadas en esta tanda de trabajo. La intencion fue mejorar experiencia movil, rendimiento de imagenes, personalizacion por marca y mantenimiento del catalogo sin romper el flujo actual de publicacion, carrito, pedidos ni panel admin.

## 1. Catalogo publico responsive

Archivos principales:

- `hosting/assets/public-catalog.js`
- `hosting/assets/public-catalog.css`

Cambios:

- Botones flotantes **Subir** y **Ver guia** ajustados para que molesten menos en celular/tablet.
- La barra de busqueda en smartphone queda visible y no escondida detras del boton de carrito.
- La guia interactiva mantiene pasos para busqueda, filtros, ficha, detalle y carrito.
- Se hicieron varios ajustes de scroll y resaltado para dispositivos pequenos. La guia funciona, aunque el resaltado automatico perfecto en todos los breakpoints queda como punto sensible para revisar con mas calma.

## 2. Zoom de imagen en detalle

Archivos principales:

- `hosting/assets/public-catalog.js`
- `hosting/assets/public-catalog.css`

Cambios:

- Se elimino la dependencia visual del boton de ampliar en una posicion incomoda.
- En detalle, la imagen ahora puede abrir vista ampliada al tocar/clickear la imagen.
- Se conserva compatibilidad con desktop, tablet y celular.

## 3. Presets visuales por marca en la app Electron

Archivos principales:

- `index.html`
- `script.js`

Cambios:

- Se agrego guardado de configuracion visual por marca.
- Cada marca puede recordar logo, colores, fondo hero, imagen promocional y ajustes visuales configurados en la app.
- Al seleccionar una marca, la app puede aplicar el preset guardado para esa marca.
- No modifica catalogos antiguos hasta que el usuario vuelva a generar/publicar.

## 4. Mejor carga de imagenes en catalogo publico

Archivos principales:

- `hosting/assets/public-catalog.js`

Cambios:

- Las primeras imagenes cargan con prioridad mayor.
- El resto carga de forma diferida para no bloquear la primera vista.
- Las tarjetas ya no esperan resoluciones pesadas antes de renderizar.
- Se agregaron candidatos y fallback de imagen para mejorar estabilidad cuando una URL falla.

## 5. Subida directa de imagenes a Backblaze desde hosting

Archivos principales:

- `hosting/catalogos_admin/catalog_update_images.php`
- `hosting/catalogos_api/backblaze_helpers.php`
- `hosting/catalogos_api/config.example.php`

Cambios:

- El admin puede actualizar la imagen de un producto por ITEM.
- Si Backblaze esta habilitado en `catalogos_api/config.php`, la imagen subida desde hosting se envia directo a Backblaze B2 usando API compatible S3.
- La URL final queda usando el CDN configurado en `cdn_base_url`.
- Si Backblaze esta desactivado, se conserva el comportamiento local del hosting.

Configuracion esperada en `catalogos_api/config.php`:

```php
'backblaze' => [
    'enabled' => true,
    'endpoint' => 'https://s3.us-west-004.backblazeb2.com',
    'region' => 'us-west-004',
    'bucket' => 'NOMBRE_DEL_BUCKET',
    'key_id' => 'B2_KEY_ID',
    'application_key' => 'B2_APPLICATION_KEY',
    'cdn_base_url' => 'https://rodeo-catalogos-img.b-cdn.net',
    'timeout' => 45,
],
```

Nota: no guardar credenciales reales en el repositorio.

## 6. Productos agotados

Archivos principales:

- `hosting/assets/public-catalog.js`
- `hosting/assets/public-catalog.css`

Cambios:

- El catalogo detecta productos agotados con campos como `outOfStock`, `agotado`, `available=0`, `sin stock`, `no disponible` u `out of stock`.
- Las tarjetas agotadas aparecen visualmente desactivadas.
- El boton de agregar queda bloqueado.
- Si un articulo agotado estaba en carrito, el flujo lo limpia/bloquea para evitar pedidos invalidos.

## 7. Actualizar catalogo vivo con productos nuevos desde Excel

Archivo principal:

- `hosting/catalogos_admin/catalog_update_data.php`

Cambios:

- La actualizacion de datos ahora puede detectar productos nuevos por ITEM.
- Los productos nuevos se agregan al inicio del catalogo para que la mercancia nueva aparezca primero.
- Se conservan campos como descripcion, precio, empaque, venta, marca, categoria, cantidad, minimo, disponibilidad y URL de imagen si el Excel la trae.
- Sigue creando backup antes de guardar cambios.

## 8. Miniaturas para imagenes nuevas

Archivos principales:

- `hosting/catalogos_admin/catalog_update_images.php`
- `hosting/assets/public-catalog.js`

Cambios:

- Al subir una imagen nueva desde el admin, el sistema intenta crear una miniatura optimizada.
- Si Backblaze esta activo, sube la miniatura a:

```text
catalogos/{slug}/updates/thumbs/
```

- Si Backblaze esta desactivado, la miniatura se guarda localmente en:

```text
media/main/thumbs/
```

- El catalogo publico prioriza miniaturas para tarjetas, dejando la imagen grande para detalle/zoom.

## 9. Miniaturas para imagenes existentes

Archivo principal:

- `hosting/catalogos_admin/catalog_update_images.php`

Cambios:

- Se agrego accion manual **Generar miniaturas faltantes**.
- Recorre productos con imagen grande y sin miniatura guardada.
- Procesa hasta 40 productos por corrida para no sobrecargar el hosting.
- Hace backup antes de escribir el `catalog.json`.
- Si Backblaze esta activo, sube las miniaturas a `updates/thumbs/`.
- Si una imagen falla, la omite y sigue con las demas.

## 10. Plantillas por marca y titulo visual

Archivos principales:

- `script.js`
- `main.js`
- `hosting/assets/public-catalog.js`
- `hosting/assets/public-catalog.css`
- `styles.css`
- `hosting/assets/img/no-photo-camera.svg`
- `hosting/assets/brand_templates/{slug}/config.json`

Cambios:

- El generador conserva `brand` y `brandSlug` por producto cuando el Excel trae columna `MARCA`.
- El `catalog.json` incluye `brandFilterEnabled`, `brands` y `activeBrand`.
- En catalogos completos con varias marcas, el catalogo publico muestra filtro desplegable de marca.
- En catalogos de una sola marca, no se muestra filtro de marca y se usa la marca como titulo visual principal.
- El campo general del catalogo no se modifica; solo cambia el titulo visual generado.
- Si existe plantilla por marca, se puede usar `bannerTitle`, logo, banner, promocion, fondo y placeholder.
- Se corrigio que los assets de marca como logo, cover y fondo se omitan cuando el modo de imagenes de producto es Backblaze. Ahora se copian al paquete del catalogo.
- El logo del header publico y del preview Electron se hizo un poco mas visible, con control responsive en movil.
- Si un producto no tiene imagen, se usa placeholder profesional `assets/img/no-photo-camera.svg` o el placeholder propio de la marca.

## Archivos para subir al hosting

Subir o reemplazar estos archivos cuando se publique esta tanda:

```text
hosting/assets/public-catalog.js
hosting/assets/public-catalog.css
hosting/catalogos_admin/catalog_update_data.php
hosting/catalogos_admin/catalog_update_images.php
hosting/catalogos_api/backblaze_helpers.php
hosting/catalogos_api/config.example.php
hosting/assets/img/no-photo-camera.svg
hosting/assets/brand_templates/
hosting/catalogos_admin/brand_templates.php
```

Importante:

- En produccion no reemplazar `catalogos_api/config.php` con el example.
- Solo copiar el bloque `backblaze` al `config.php` real.
- Mantener credenciales reales fuera del repositorio.
- Para que una correccion de logo/titulo visual llegue a un catalogo ya publicado, hay que regenerar y volver a publicar ese catalogo desde Electron.

## Como probar despues de subir

1. Abrir un catalogo publico en desktop, tablet y celular.
2. Confirmar que busqueda, filtros, detalle, carrito y pedido siguen funcionando.
3. En admin, actualizar una imagen por ITEM.
4. Confirmar que la imagen aparece en Backblaze/CDN si `backblaze.enabled` esta activo.
5. Ejecutar **Generar miniaturas faltantes** una vez y revisar el mensaje.
6. Abrir el catalogo y confirmar que las tarjetas cargan imagenes mas rapido.
7. Probar un producto agotado y confirmar que no permite agregarlo.
8. Actualizar datos desde Excel con un ITEM nuevo y verificar que aparece al inicio.
9. Generar catalogo completo con varias marcas y confirmar que aparece el filtro de marca.
10. Generar catalogo por una sola marca y confirmar que no aparece filtro de marca, y que el titulo visual usa esa marca.
11. Confirmar que el logo aparece en el header despues de regenerar/publicar el catalogo.

## Requisitos del hosting para estas fases

- PHP 8.1 o superior recomendado.
- Extension `curl` habilitada para Backblaze y descarga de imagenes remotas.
- Extension `gd` habilitada para crear miniaturas.
- Permisos de escritura en carpetas de catalogos publicados y backups.

## Pendientes recomendados

- Pedidos manuales desde panel de vendedores.
- Reintento/cola para imagenes que fallen al crear miniatura.
- Revision fina de la guia interactiva en todos los breakpoints.
- Pantalla de diagnostico de Backblaze/CDN para probar configuracion desde admin.

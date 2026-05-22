# Catalogo Rodeo B2B

Sistema completo para generar catalogos comerciales desde una app local de escritorio y publicarlos en un hosting PHP/MySQL con panel administrativo, panel de vendedores, links seguros para clientes y registro de pedidos.

Repositorio oficial: https://github.com/C-TECHPTY/catalogo_rodeo

Estado de esta version: paquete local Electron + plataforma B2B PHP/MySQL listos para instalacion, publicacion de catalogos, links seguros, carrito con confirmacion de pedido, tokens publicos por vendedor, trazabilidad y gestion segura de pedidos.

## Resumen General

El programa tiene dos partes principales:

- **App de escritorio Electron**: permite cargar Excel e imagenes, generar catalogos PDF, crear una vista web B2B moderna, personalizar colores/logos/fondos, guardar paquetes locales y subir catalogos al hosting por FTP.
- **Plataforma en hosting PHP/MySQL**: recibe catalogos publicados, administra vendedores/clientes/usuarios, genera links seguros, controla vencimientos, recibe pedidos del carrito y permite exportarlos en CSV/XLSX/PDF.

El flujo recomendado es:

1. Cargar Excel e imagenes en la app.
2. Configurar titulo, colores, logo, vigencia, FTP y API.
3. Generar o previsualizar el catalogo.
4. Usar **Subir al hosting** para publicar.
5. Entrar al panel admin y crear un link seguro para compartir con el cliente.
6. El cliente abre el catalogo, agrega productos al carrito, revisa el resumen y confirma el envio.
7. Admin o vendedor revisa/exporta el pedido desde el panel.

Para enviar un catalogo publicado a todos los vendedores activos:

1. Publicar el catalogo desde la app.
2. Ejecutar la migracion `hosting/sql/20260505_catalog_seller_email_logs.sql` si la tabla de logs aun no existe.
3. Entrar al panel admin en `catalogos_admin/catalogos.php`.
4. Usar **Enviar a vendedores** en el catalogo activo.
5. Confirmar el envio y dejar marcada la opcion **Crear link seguro si no existe**.
6. Cada vendedor recibe un correo individual con su enlace `?token=TOKEN`; los pedidos hechos desde ese enlace quedan asociados a ese vendedor.

## Cambios Recientes

Cambios incorporados el 2026-05-15:

- Ajustes responsive del catalogo publico para busqueda movil, botones flotantes **Subir/Ver guia** y comportamiento de la guia interactiva.
- La imagen del detalle puede abrirse en vista ampliada al tocar/clickear, reduciendo la dependencia de un boton de zoom fijo.
- Presets visuales por marca en la app Electron para recordar logo, colores, fondo hero e imagenes promocionales por marca.
- Carga de imagenes optimizada en el catalogo publico con prioridad para primeras tarjetas, lazy loading y fallback de candidatos.
- Nueva subida de imagen por ITEM desde el hosting con soporte opcional Backblaze B2/CDN y fallback al hosting local.
- Productos agotados se muestran desactivados y no pueden agregarse al carrito.
- Actualizacion de catalogo vivo desde Excel puede agregar productos nuevos al inicio del catalogo.
- Miniaturas automaticas para imagenes nuevas y accion admin **Generar miniaturas faltantes** para imagenes existentes.
- Nueva fase opcional **Plantillas por marca** mediante carpetas `hosting/assets/brand_templates/{slug}/config.json`, con logo, colores, banner, publicidad, fondo y placeholder por marca.
- En modo **Solo una marca**, el preview y el catalogo generado usan la marca seleccionada como titulo visual principal sin cambiar el titulo base guardado.
- Correccion para copiar logo/cover/fondo de marca al paquete aunque las imagenes de productos usen Backblaze.
- Documentacion completa de esta tanda en `docs/RESUMEN_CAMBIOS_2026-05-15.md`.

Cambios incorporados el 2026-05-05:

- Color corporativo por defecto actualizado a `#2c4695` en la app, preview y estilos base.
- Campo editable **Texto hero B2B** para cambiar el texto del hero publicado sin modificar codigo.
- Tarjetas del catalogo publico y vista previa B2B muestran **Disp:** cuando existe disponible del producto.
- Vista previa B2B recupera categoria, empaque, venta, minimo, disponibilidad, precio y botones para evitar una previsualizacion incompleta.
- Plantilla de correo de campanas revisada para conservar compatibilidad con el envio actual del hosting sin modificar SMTP.
- Nueva accion admin **Enviar a vendedores** desde catalogos publicados.
- Nueva pantalla `hosting/catalogos_admin/send_catalog_to_sellers.php` para confirmar envio, contar vendedores, crear/reutilizar links seguros y mostrar resumen.
- Nueva migracion `hosting/sql/20260505_catalog_seller_email_logs.sql` para registrar cada envio de catalogo a vendedor.

Cambios incorporados en la fase del 2026-04-28:

- Flujo publico de pedido confirmado: el boton del carrito ahora abre **Revisar pedido**, muestra datos del cliente, lineas, cantidades y total, y exige confirmacion antes de enviar.
- Trazabilidad de confirmacion: los pedidos guardan `customer_confirmed`, `confirmed_at` e IP del cliente cuando la base tiene las columnas de FASE 2.
- Token publico por vendedor: cada vendedor puede tener `public_token` y compartir enlaces de catalogo con `?t=TOKEN`; la API resuelve vendedor por token y lo conserva en accesos, tracking y pedidos.
- Panel de vendedores: muestra links directos por vendedor cuando existe un catalogo publico activo y el vendedor tiene token.
- Panel admin de pedidos: agrega estados `pendiente`, `confirmado`, `anulado` y `archivado`, marca de pedido de prueba, archivo/limpieza segura y acciones que evitan eliminar pedidos reales.
- Correos de pedido: asunto con vendedor y cliente, confirmacion del cliente, enlace directo al pedido en admin y destinatarios administrativos configurables con `order_admin_emails`.
- SQL base actualizado con las nuevas columnas e indices; para instalaciones existentes se agregaron migraciones por fases.

## Estructura Del Proyecto

```text
catalogo_rodeo-main/
  index.html              Interfaz de la app Electron
  script.js               Logica principal de la app
  main.js                 Proceso principal Electron, exportacion, PDF, FTP y ZIP
  preload.js              Puente seguro entre Electron y la interfaz
  styles.css              Estilos de la app y vista previa
  package.json            Dependencias y comando de inicio
  fonts/                  Fuentes usadas por PDF/app
  hosting/
    README.md             Guia especifica del paquete hosting
    assets/               CSS/JS compartido del catalogo publico y paneles
    catalogos_api/        API PHP para publicar catalogos y registrar pedidos
    catalogos_admin/      Panel administrativo
    catalogos_vendedor/   Panel de vendedores
    sql/                  SQL base y migraciones
```

## App De Escritorio

La app local funciona con Electron y se ejecuta en Windows desde el proyecto.

### Funciones principales

- Cargar un archivo Excel con productos.
- Leer columna opcional `MARCA` sin afectar archivos Excel antiguos.
- Generar catalogo completo, por una marca o paquetes separados por marca.
- Asociar imagenes principales por ITEM/SKU.
- Asociar galeria y video por producto.
- Configurar titulo, pie de pagina, plantilla, colores, logo y fondo.
- Vista previa en dos modos:
  - **Vista web B2B moderna**
  - **Vista PDF legado**
- Exportar PDF manual.
- Generar PDFs por lote usando carpetas de categorias.
- Guardar paquete web local.
- Subir catalogo al hosting por FTP/FTPS.
- Registrar catalogo en la API del hosting.
- Guardar configuracion de publicacion en la PC local.

### Comandos locales

Instalar dependencias:

```bash
npm install
```

Abrir la app:

```bash
npm start
```

Crear ejecutable para Windows:

```bash
npm run dist:win
```

El ejecutable queda en `release/Catalogo Rodeo B2B-win32-x64/Catalogo Rodeo B2B.exe` y se puede abrir con doble clic, sin ejecutar `npm start`. Mantén el `.exe` junto con las carpetas y DLLs que genera Electron en esa carpeta.

Nota: el ejecutable de un solo archivo portable requiere permisos de symlink en Windows durante el build. Esta configuracion genera una carpeta lista para usar, que es la opcion mas estable para esta PC.

Validar sintaxis JS:

```bash
node --check script.js
node --check main.js
node --check hosting/assets/public-catalog.js
```

## Botones Importantes En La App

- **Generar catalogo**: renderiza la vista actual dentro de la app.
- **Imprimir / Exportar PDF**: genera PDF desde la vista legado.
- **Guardar paquete local**: crea el catalogo web en una carpeta local. Esto no sube nada al hosting.
- **Subir al hosting**: comprime el catalogo, lo sube por FTP y lo registra en la API.
- **Probar FTP**: valida la conexion FTP antes de publicar.

Si aparece el mensaje `Paquete local listo en C:\...`, significa que solo se guardo en la computadora. Para publicar online hay que usar **Subir al hosting**.

## Publicacion Al Hosting

Para publicar desde la app se deben completar estos campos:

- URL base publica: ejemplo `https://rodeoimportzl.com/catalogos`
- API base publica: ejemplo `https://rodeoimportzl.com/catalogos_api`
- FTP host
- Protocolo FTP o FTPS
- Puerto
- Usuario FTP
- Clave FTP
- Ruta remota catalogos: ejemplo `/public_html/catalogos`
- API key privada configurada en `catalogos_api/config.php`
- Carpeta salida web local

Durante la subida, la app muestra barra de progreso:

- Preparando paquete web
- Comprimiendo ZIP
- Subiendo ZIP
- Registrando catalogo en el panel
- Publicacion completada

## Hosting PHP/MySQL

La carpeta `hosting/` contiene todo lo necesario para instalar la plataforma web.

### Carpetas del hosting

```text
public_html/
  catalogos/              Catalogos publicados, uno por slug
  catalogos_api/          API PHP
  catalogos_admin/        Panel admin
  catalogos_vendedor/     Panel vendedor
  assets/                 CSS/JS compartidos
```

### API

La API vive en `hosting/catalogos_api/`.

Endpoints principales:

- `publish_uploaded_zip.php`: registra un catalogo subido por ZIP desde la app.
- `publish_catalog.php`: registra catalogos por payload directo.
- `public_catalog.php`: entrega metadata del catalogo publico.
- `submit_order.php`: recibe pedidos del carrito.
- `export_order.php`: exporta pedidos en CSV, XLSX o PDF.
- `check_catalog.php`: verifica disponibilidad del catalogo.

### Panel admin

El panel admin vive en `hosting/catalogos_admin/`.

Funciones:

- Dashboard general.
- Gestion de catalogos publicados.
- Crear, activar, archivar y eliminar catalogos.
- Gestion de links seguros.
- Envio de catalogos publicados a vendedores activos con link seguro individual.
- Gestion de vendedores.
- Gestion de clientes.
- Gestion de usuarios admin/vendedor.
- Revision de pedidos.
- Acciones seguras para anular, archivar, marcar pruebas y limpiar solo pedidos de prueba.
- Exportaciones.
- Configuracion operativa.

### Panel Super Admin

El panel Super Admin vive en `hosting/super_admin/` y es independiente del panel admin actual.

Ruta de acceso segun configuracion del hosting:

```text
https://rodeoimportzl.com/hosting/super_admin/login.php
```

Si el dominio apunta directamente a la carpeta `hosting/`, usar:

```text
https://rodeoimportzl.com/super_admin/login.php
```

Migracion requerida:

```text
hosting/sql/20260505_super_admin_base.sql
```

Esta migracion se ejecuta en la misma base de datos actual y crea solo tablas nuevas con prefijo `sa_`:

- `sa_admin_users`
- `sa_companies`
- `sa_subscriptions`
- `sa_licenses`
- `sa_activity_logs`

Usuario Super Admin inicial creado para la instalacion actual:

```text
Email: admin@rodeoimportzl.com
Contrasena: no versionar en README ni en GitHub; guardarla en un gestor seguro.
```

Para crear o resetear una contrasena, generar primero el hash:

```bash
php -r "echo password_hash('TU_CLAVE_SEGURA', PASSWORD_DEFAULT), PHP_EOL;"
```

Luego insertar o actualizar `sa_admin_users` desde phpMyAdmin usando el hash generado, nunca la contrasena en texto plano.

Ejemplo para crear usuario:

```sql
INSERT INTO sa_admin_users (name, email, password_hash, role, status)
VALUES (
  'Nelson Sanchez',
  'admin@rodeoimportzl.com',
  'HASH_GENERADO_CON_PASSWORD_HASH',
  'super_admin',
  'active'
);
```

Este modulo solo administra empresas, suscripciones y licencias preparatorias. No conecta todavia empresas con catalogos reales, pedidos, vendedores, campanas ni app PC.

### Panel vendedor

El panel vendedor vive en `hosting/catalogos_vendedor/`.

Funciones:

- Acceso con usuario y clave.
- Ver catalogos asignados.
- Copiar enlace publico del catalogo con token del vendedor.
- Crear/ver links segun permisos.
- Revisar pedidos propios.

## Catalogo Publico B2B

El catalogo publicado tiene:

- Header con logo, vendedor, cliente y estado.
- Busqueda por SKU, descripcion, marca o categoria.
- Hero comercial con color del catalogo.
- Filtros por categoria.
- Tarjetas de producto.
- Disponibilidad visible con etiqueta **Disp:** cuando el producto incluye ese dato.
- Vista de detalle con imagenes/video.
- Carrito lateral con scroll interno.
- Modal de revision de pedido antes del envio.
- Confirmacion obligatoria del cliente antes de registrar el pedido.
- Formulario de pedido:
  - Empresa
  - Contacto
  - Telefono
  - Correo
  - Direccion o zona
  - Observaciones
- Envio de pedido confirmado a la API.
- Soporte de cola offline si hay problemas de conexion.

Los catalogos pueden abrirse por URL base, pero el flujo recomendado para clientes es compartir links seguros generados en el panel admin.

## Links Seguros Y Vencimientos

El panel admin permite generar enlaces con token para controlar acceso comercial.

Cada link puede tener:

- Catalogo asociado.
- Vendedor.
- Cliente.
- Etiqueta.
- Fecha de expiracion.
- Notas.
- Estado activo/inactivo.

Si el catalogo o link vence, la interfaz publica bloquea el contenido y muestra mensaje de no disponible.

## Tokens Por Vendedor

Ademas de los links seguros por cliente, la plataforma puede usar enlaces con token publico de vendedor:

```text
https://dominio.com/catalogos/slug/?t=TOKEN_DEL_VENDEDOR
```

Este token permite atribuir el catalogo, el tracking y los pedidos al vendedor aunque no exista un link seguro especifico para cliente. El token se guarda en `sellers.public_token`, se puede consultar desde el panel de vendedores y se conserva como `orders.seller_token` cuando se registra el pedido.

## Base De Datos

Archivos SQL:

- `hosting/sql/catalog_platform.sql`: instalacion base.
- `hosting/sql/20260418_b2b_upgrade.sql`: migracion evolutiva.
- `hosting/sql/20260419_b2b_schema_compat.sql`: compatibilidad adicional de esquema.
- `hosting/sql/20260423_intelligence_events.sql`: tracking e inteligencia comercial.
- `hosting/sql/20260424_seller_photo_branding.sql`: foto de vendedor y branding visual.
- `hosting/sql/20260425_campaigns_module.sql`: modulo de campanas promocionales.
- `hosting/sql/20260428_phase1_order_safety.sql`: seguridad de pedidos, estados nuevos, marca de prueba y limpieza segura.
- `hosting/sql/20260428_phase2_customer_confirmation.sql`: confirmacion del cliente antes de enviar pedido.
- `hosting/sql/20260428_phase3_seller_tokens.sql`: token publico por vendedor y token asociado al pedido.
- `hosting/sql/20260428_phase4_order_email_settings.sql`: correos administrativos configurables para pedidos.
- `hosting/sql/20260505_catalog_seller_email_logs.sql`: logs de envio de catalogos publicados a vendedores.

Instalacion nueva:

1. Crear base de datos MySQL/MariaDB.
2. Importar `catalog_platform.sql`.
3. Copiar `catalogos_api/config.example.php` como `catalogos_api/config.php`.
4. Configurar credenciales DB, API key, correo y zona horaria.
5. Subir carpetas del hosting.

Instalacion existente:

1. Hacer backup de base de datos y archivos.
2. Ejecutar migraciones necesarias en orden cronologico.
3. Subir/reemplazar `catalogos_api/`, `catalogos_admin/`, `catalogos_vendedor/` y `assets/`.

Para activar los cambios de pedido confirmado, tokens por vendedor y correos administrativos en una base existente, ejecutar como minimo:

```text
20260428_phase1_order_safety.sql
20260428_phase2_customer_confirmation.sql
20260428_phase3_seller_tokens.sql
20260428_phase4_order_email_settings.sql
20260505_catalog_seller_email_logs.sql
```

La migracion `20260505_catalog_seller_email_logs.sql` es obligatoria para usar **Enviar a vendedores**. Si falta, la pantalla muestra aviso y no envia correos para evitar perder trazabilidad.

## Usuarios

Los usuarios se administran desde:

```text
catalogos_admin/usuarios.php
```

Roles principales:

- `admin`: acceso administrativo.
- `seller`: acceso vendedor.

Los vendedores deben existir en `Vendedores` y luego se les puede asociar un usuario.

## Seguridad

Recomendaciones importantes:

- Cambiar la API key en `catalogos_api/config.php`.
- Usar HTTPS.
- Cambiar clave del usuario admin inicial.
- No exponer la carpeta `sql/` si el hosting permite moverla fuera de `public_html`.
- Usar contrasenas fuertes para admin y vendedores.
- Mantener `catalog.json` bloqueado por `.htaccess` en catalogos publicados.
- Compartir con clientes links seguros, no necesariamente la URL base directa.
- Compartir links `?t=TOKEN` solo con vendedores autorizados; no publicar tokens de vendedor en lugares no controlados.

## Paquete Hosting

Cuando se modifica el sistema web, se puede regenerar:

```powershell
Compress-Archive -Path hosting\catalogos_admin,hosting\catalogos_api,hosting\assets -DestinationPath hosting\hosting.zip -Force
```

Luego subir `hosting/hosting.zip` al hosting y extraerlo reemplazando archivos existentes.

No hace falta borrar carpetas de catalogos ya publicados como:

```text
catalogos/acenox/
catalogos/acenox6/
catalogos/otro-slug/
```

## Solucion De Problemas

### Sale `Paquete local listo en C:\...`

Eso significa que se uso **Guardar paquete local**. Para publicar online usa **Subir al hosting**.

### El color se ve bien en la app pero no en hosting

Sube el paquete hosting actualizado y vuelve a publicar el catalogo desde la app. Los catalogos ya publicados pueden conservar archivos antiguos hasta regenerarse.

### El carrito no deja llegar al boton de enviar

Reemplaza `assets/public-catalog.css` en hosting o vuelve a publicar el catalogo con la version actual. El panel del carrito tiene scroll interno.

### El catalogo dice que no esta disponible

Revisar:

- Estado del catalogo en admin.
- Fecha de expiracion.
- Link seguro activo.
- Token correcto.
- Registro del catalogo en base de datos.

### Error 500 en PHP

Revisar:

- Version PHP.
- Credenciales de `config.php`.
- Tabla o columna faltante.
- Logs del hosting.
- Que se hayan ejecutado las migraciones SQL.

### No se envian correos de pedidos

Revisar:

- Correos configurados en `catalogos_admin/configuracion.php`.
- Si se usa el campo **Correos administrativos de pedidos**, validar que `order_admin_emails` tenga correos separados por coma o punto y coma.
- Que el vendedor tenga correo en `catalogos_admin/sellers.php`.
- Que el pedido entre por un link seguro asociado al vendedor o por un enlace `?t=TOKEN` si se espera copia al vendedor.
- Que `Copiar a vendedor` este activo en Configuracion.
- Que `catalogos_api/config.php` tenga un `mail.from_email` real del dominio.
- Que el hosting permita `mail()` de PHP. En Configuracion > Ultimas notificaciones se ve si `mail()` devolvio `OK` o `false`.
- En cPanel > Track Delivery, el remitente debe ser el `mail.from_email` configurado. Si aparece el usuario del servidor o un error `550 5.7.1 EASender blocked`, crea/usa un correo real del dominio como remitente o cambia a SMTP autenticado.
- Si el hosting bloquea `mail()`, activar SMTP autenticado en `catalogos_api/config.php`:

```php
'mail' => [
    'from_name' => 'Rodeo Import',
    'from_email' => 'catalogos@rodeoimportzl.com',
    'smtp' => [
        'enabled' => true,
        'host' => 'mail.rodeoimportzl.com',
        'port' => 465,
        'encryption' => 'ssl',
        'username' => 'catalogos@rodeoimportzl.com',
        'password' => 'CLAVE_DEL_CORREO',
        'timeout' => 20,
    ],
],
```

En cPanel estos datos suelen estar en Email Accounts > Connect Devices.

### No se envia el catalogo a vendedores

Revisar:

- Que el catalogo este activo y tenga `public_url`.
- Que existan vendedores activos con correo valido.
- Que exista la tabla `catalog_seller_email_logs`; ejecutar `20260505_catalog_seller_email_logs.sql`.
- Que el hosting permita `mail()` o que SMTP este configurado en `catalogos_api/config.php`.
- Que el correo remitente configurado sea real y pertenezca al dominio.
- En cPanel > Track Delivery, revisar si el servidor acepto el mensaje o si MailChannels lo bloqueo con `550 5.7.1`.

### No exporta pedidos XLSX/PDF

Revisar:

- Permisos del usuario.
- Que el pedido exista.
- Que la tabla `orders` tenga las columnas de compatibilidad.
- Ejecutar migracion `20260419_b2b_schema_compat.sql` si aplica.

## Archivos Clave

- `script.js`: logica de interfaz, Excel, productos, colores, preview y publicacion.
- `main.js`: Electron, generacion HTML/PDF, ZIP, FTP y API.
- `styles.css`: estilos de app, PDF y preview B2B.
- `hosting/assets/public-catalog.css`: estilos del catalogo publico.
- `hosting/assets/public-catalog.js`: carrito, busqueda, filtros, envio de pedidos.
- `hosting/catalogos_api/helpers.php`: funciones compartidas de API, catalogos, pedidos y exportaciones.
- `hosting/catalogos_admin/catalogos.php`: administracion de catalogos.
- `hosting/catalogos_admin/send_catalog_to_sellers.php`: envio de catalogos publicados a vendedores con link seguro individual.
- `hosting/catalogos_admin/pedidos.php`: revision, estados, acciones seguras y limpieza de pedidos de prueba.
- `hosting/catalogos_admin/sellers.php`: vendedores, tokens y enlaces por vendedor.
- `hosting/catalogos_admin/usuarios.php`: gestion de usuarios.

## Notas Operativas

- El color seleccionado en la app viaja en `catalog.json` y en el registro API.
- El logo PNG transparente se conserva para la vista web cuando corresponde.
- El catalogo publico carga CSS/JS desde su carpeta `assets/`.
- Si se cambia CSS/JS del catalogo publico, hay que volver a publicar o reemplazar esos archivos dentro del catalogo ya publicado.
- El panel admin controla catalogos, pero la app local es la encargada de construir y subir el paquete web.

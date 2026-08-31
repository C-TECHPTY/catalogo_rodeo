# Dashboard product live edit - Fase 1

## Diagnostico actual

- Electron vive en la raiz (`main.js`, `preload.js`, `script.js`, `index.html`) y genera/publica el catalogo base.
- El hosting PHP esta en `hosting/`.
- El panel admin esta en `hosting/catalogos_admin/`.
- El API publico esta en `hosting/catalogos_api/`.
- El catalogo online se sirve desde `hosting/catalogos_api/public_catalog.php`, que arma el payload en `build_public_catalog_payload()`.
- Los productos publicados siguen saliendo del `catalog_json_path` o `api_payload` de `catalogs`.
- Ya existian pantallas para actualizar CSV, imagenes y visuales, pero esas pantallas escribian sobre el catalogo publicado o su JSON. Esta fase agrega una capa MySQL paralela.

## Archivos tocados

- `hosting/sql/20260604_catalog_product_live_edits.sql`
- `hosting/catalogos_api/helpers.php`
- `hosting/catalogos_admin/catalog_product_live_edit.php`
- `hosting/catalogos_admin/catalogos.php`
- `hosting/catalogos_admin/catalog_history.php`

## Archivos que no se deben tocar en esta fase

- `main.js`
- `preload.js`
- `script.js`
- `index.html`
- Logica de generacion/publicacion Electron
- Rutas publicas existentes del catalogo

## Migracion

Ejecutar en MySQL:

```sql
SOURCE hosting/sql/20260604_catalog_product_live_edits.sql;
```

La migracion solo crea tablas nuevas:

- `catalog_product_live_edits`
- `catalog_product_live_edit_history`

No borra datos y no altera tablas existentes.

## Uso desde dashboard

1. Entrar al panel admin.
2. Ir a `Catalogos`.
3. En un catalogo activo, abrir `Editar productos vivo`.
4. Buscar el ITEM/SKU.
5. Editar:
   - descripcion
   - precio
   - cantidad disponible
   - estado activo/inactivo
   - imagen principal por URL o subida de archivo
6. Guardar.

El API publico aplica los cambios guardados en MySQL encima del JSON generado. Si el producto se marca inactivo, no aparece en el payload publico del catalogo.

## Alcance de Fase 1

Incluido:

- editar productos ya publicados por ITEM
- actualizar cantidad, precio, descripcion, estado e imagen
- subir imagen nueva sin regenerar todo el catalogo
- guardar historial basico campo por campo
- validar ITEM duplicado en el catalogo base
- mantener Electron como carga inicial masiva

Pendiente para fases siguientes:

- agregar productos nuevos manualmente
- marca, empaque, categoria y etiqueta mercancia nueva
- importacion Excel/CSV incremental directa a MySQL
- sincronizacion completa de productos base hacia tablas MySQL normalizadas

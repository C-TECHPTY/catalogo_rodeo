# Dashboard product live import - Fase 3

## Objetivo

Importar cambios comerciales desde CSV/XLSX al catalogo online sin regenerar desde Electron.

La importacion escribe solo en MySQL:

- `catalog_product_live_edits`
- `catalog_product_live_edit_history`
- `catalog_product_live_import_logs`

No modifica `catalog.json`, no cambia Electron y no elimina productos.

## Archivos agregados/modificados

- `hosting/catalogos_admin/catalog_product_live_import.php`
- `hosting/catalogos_admin/catalogos.php`
- `hosting/catalogos_admin/catalog_history.php`
- `hosting/sql/20260604_catalog_product_live_imports_phase3.sql`
- `docs/DASHBOARD_PRODUCT_LIVE_IMPORT_PHASE3.md`

## Migracion

Ejecutar despues de Fase 1 y Fase 2:

```sql
SOURCE hosting/sql/20260604_catalog_product_live_imports_phase3.sql;
```

## Uso

1. Entrar al panel admin.
2. Ir a `Catalogos`.
3. Abrir `Importar productos vivo`.
4. Subir CSV o XLSX.
5. Revisar vista previa.
6. Confirmar importacion.

## Columnas aceptadas

- `ITEM`
- `DESCRIPCION`
- `PRECIO`
- `DISPONIBLE`
- `MARCA`
- `EMPAQUE`
- `CATEGORIA`
- `ACTIVO`
- `MERCANCIA_NUEVA`
- `IMAGE_URL`

Tambien acepta alias comunes como `SKU`, `STOCK`, `CANTIDAD`, `BRAND`, `CATEGORY`, `URLIMAGEN`.

## Productos nuevos

Los ITEM que no existan se crean como productos manuales por defecto.

Si no quieres crear nuevos productos, desmarca:

```text
Crear como productos manuales los ITEM que no existan.
```

## Imagenes faltantes

Si hay productos nuevos sin imagen, la vista previa los muestra en una tabla.

Antes de confirmar, sube las imagenes nombradas con el ITEM:

```text
ABC123.jpg
ABC124.png
ABC125.webp
```

El sistema agrega esas imagenes a la vista previa y solo permite confirmar cuando ya no faltan imagenes para productos nuevos.

## Actualizar solo una marca

En `Marca a actualizar` escribe la marca, por ejemplo:

```text
LUXURY HOME LINENS
```

El importador actualiza solo las filas de esa marca dentro del catalogo seleccionado.

Si el archivo no trae columna `MARCA`, el sistema intenta usar la marca que ya tiene el producto en el catalogo.

Si dejas la marca vacia, actualiza todo el catalogo seleccionado.

## Notas

- XLSX requiere que PHP tenga habilitado `ZipArchive`.
- Si el servidor no tiene `ZipArchive`, usar CSV.
- La importacion crea historial campo por campo.
- El catalogo publico lee estos cambios desde el API ya ajustado en fases anteriores.

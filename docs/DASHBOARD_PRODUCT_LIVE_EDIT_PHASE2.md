# Dashboard product live edit - Fase 2

## Objetivo

Permitir crear productos nuevos manualmente desde el dashboard, sin regenerar el catalogo desde Electron y sin modificar el `catalog.json` base.

## Archivos tocados en esta fase

- `hosting/sql/20260604_catalog_product_live_edits.sql`
- `hosting/sql/20260604_catalog_product_live_edits_phase2.sql`
- `hosting/catalogos_admin/catalog_product_live_edit.php`
- `hosting/catalogos_api/helpers.php`

## Migracion

Si aun no aplicaste Fase 1, ejecuta:

```sql
SOURCE hosting/sql/20260604_catalog_product_live_edits.sql;
```

Si ya aplicaste Fase 1, ejecuta tambien:

```sql
SOURCE hosting/sql/20260604_catalog_product_live_edits_phase2.sql;
```

La Fase 2 agrega columnas para:

- marca
- empaque
- categoria
- mercancia nueva
- tipo de registro: override o manual
- payload base del producto manual

## Uso

1. Entrar al panel admin.
2. Ir a `Catalogos`.
3. Abrir `Editar productos vivo`.
4. Buscar un ITEM que no exista en el catalogo base.
5. Completar el formulario de producto manual.
6. Guardar.

El producto manual queda guardado en MySQL y el API publico lo agrega al payload del catalogo online.

## Validaciones

- No permite crear un ITEM manual si ya existe en el catalogo base.
- No permite crear un ITEM manual si ya existe en la capa viva.
- Mantiene historial campo por campo.
- Permite desactivar el producto manual sin borrarlo.

## Electron

Electron no cambia. Sigue funcionando como herramienta de carga inicial masiva.

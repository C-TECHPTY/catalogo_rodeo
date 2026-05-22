# Catalogos automaticos por rotacion - Fase 1 hosting

Fecha: 2026-05-18

Esta fase agrega generacion manual de catalogos automaticos desde un catalogo base. Queda apagada por defecto, no activa cron y no envia WhatsApp automaticamente.

## Archivos creados

- `hosting/sql/20260518_auto_catalogs.sql`
- `hosting/catalogos_api/auto_catalog_helpers.php`
- `hosting/catalogos_api/run_auto_catalog.php`
- `hosting/catalogos_admin/auto_catalogs.php`
- `hosting/catalogos/auto_seller.php`
- `docs/auto_catalogs_hosting_phase1.md`

## Archivos modificados

- `hosting/catalogos_admin/_bootstrap.php`
  - Agrega el enlace de menu `Catalogos automaticos` si existe el archivo.
- `hosting/catalogos_api/helpers.php`
  - Agrega reconocimiento de tokens de `auto_catalog_seller_sessions` cuando no existe un vendedor normal con ese token.
  - No modifica `submit_order.php`; los pedidos siguen usando el flujo actual y quedan trazables por `seller_token` y `seller_name`.

## SQL a importar

Importar en MySQL:

```sql
hosting/sql/20260518_auto_catalogs.sql
```

El SQL crea tablas nuevas:

- `auto_catalog_rules`
- `auto_catalog_runs`
- `auto_catalog_run_items`
- `auto_catalog_seller_sessions`

Tambien crea configuraciones apagadas por defecto:

- `auto_catalogs_enabled = 0`
- `auto_catalogs_api_key = ''`

## Como activar en hosting

1. Subir los archivos nuevos y modificados.
2. Importar `hosting/sql/20260518_auto_catalogs.sql`.
3. Entrar al admin.
4. Abrir `Catalogos automaticos`.
5. Activar el modulo manualmente.
6. Generar una clave privada API si se necesita usar `run_auto_catalog.php`.
7. Crear una regla:
   - nombre
   - catalogo base
   - cantidad de productos
   - dias sin repetir
   - regla activa
8. Presionar `Generar ahora`.

## Como funciona

La regla lee el `catalog.json` del catalogo base, toma productos disponibles, excluye productos usados recientemente y genera un catalogo nuevo copiando la carpeta publica del catalogo base.

El catalogo base no se borra ni se modifica.

## Link interno de vendedor

Cada ejecucion genera un link interno similar a:

```text
https://dominio.com/catalogos/auto_seller.php?run=TOKEN
```

El vendedor escribe solo su nombre, por ejemplo:

```text
DANIEL
```

El sistema genera un link de cliente:

```text
https://dominio.com/catalogos/catalogo-generado/?t=TOKEN_VENDEDOR
```

Los pedidos quedan asociados al `seller_token` y al `seller_name`.

## API manual

Endpoint:

```text
hosting/catalogos_api/run_auto_catalog.php?key=CLAVE_SEGURA
```

Opcional:

```text
hosting/catalogos_api/run_auto_catalog.php?key=CLAVE_SEGURA&rule_id=1
```

Respuesta esperada:

```json
{
  "ok": true,
  "catalog_id": 123,
  "slug": "auto-catalogo-20260518-150000",
  "public_url": "https://dominio.com/catalogos/auto-catalogo-20260518-150000/",
  "internal_seller_url": "https://dominio.com/catalogos/auto_seller.php?run=...",
  "whatsapp_message": "..."
}
```

## Como probar

1. Produccion actual:
   - Abrir un catalogo existente.
   - Crear un pedido normal.
   - Confirmar que funciona igual.

2. SQL:
   - Importar `20260518_auto_catalogs.sql`.
   - Verificar que el admin muestra `Catalogos automaticos`.

3. Modulo apagado:
   - Intentar generar sin activar.
   - Debe mostrar error de modulo desactivado.

4. Regla manual:
   - Activar modulo.
   - Crear regla con catalogo base.
   - Presionar `Generar ahora`.
   - Confirmar que aparece una ejecucion exitosa.

5. No repetir:
   - Ejecutar dos veces la misma regla.
   - Confirmar que evita productos usados dentro del rango cuando haya suficientes productos disponibles.

6. Link vendedor:
   - Abrir el link interno.
   - Escribir `DANIEL`.
   - Copiar link de cliente.
   - Abrir link de cliente y hacer pedido.
   - Confirmar en admin de pedidos que aparece token/nombre del vendedor.

## Como desactivar

En admin:

1. Entrar a `Catalogos automaticos`.
2. Desmarcar `Activar modulo`.
3. Guardar.

Tambien se puede desactivar por SQL:

```sql
UPDATE app_settings
SET setting_value = '0'
WHERE setting_key = 'auto_catalogs_enabled';
```

## Rollback

Para revertir sin tocar catalogos existentes:

1. Quitar del hosting:
   - `hosting/catalogos_api/auto_catalog_helpers.php`
   - `hosting/catalogos_api/run_auto_catalog.php`
   - `hosting/catalogos_admin/auto_catalogs.php`
   - `hosting/catalogos/auto_seller.php`
2. Restaurar las versiones anteriores de:
   - `hosting/catalogos_admin/_bootstrap.php`
   - `hosting/catalogos_api/helpers.php`
3. Opcionalmente borrar tablas nuevas:

```sql
DROP TABLE IF EXISTS auto_catalog_seller_sessions;
DROP TABLE IF EXISTS auto_catalog_run_items;
DROP TABLE IF EXISTS auto_catalog_runs;
DROP TABLE IF EXISTS auto_catalog_rules;
DELETE FROM app_settings WHERE setting_key IN ('auto_catalogs_enabled', 'auto_catalogs_api_key');
```

## Cron mas adelante

No queda cron activo en esta fase.

Cuando se quiera activar, usar una tarea que llame:

```text
https://dominio.com/catalogos_api/run_auto_catalog.php?key=CLAVE_SEGURA
```

Solo hacerlo despues de validar manualmente reglas, links y pedidos.

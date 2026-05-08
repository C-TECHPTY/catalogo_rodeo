# Conexion preparatoria del Super Admin SaaS

Esta fase prepara la base multiempresa sin cambiar el flujo actual de Rodeo Import.
No agrega `company_id` a tablas reales como `catalogs`, `orders`, `sellers`, `clients` o campañas, y no modifica SMTP, FTP, API key ni `config.php`.

## Que se agrego

- Migracion segura: `hosting/sql/20260508_super_admin_connect_companies.sql`
- Helper central: `hosting/includes/company_context.php`
- Endpoint opcional: `hosting/catalogos_api/validate_license.php`
- Pantalla de dominios: `hosting/super_admin/company_domains.php`
- Campos preparatorios en el formulario de empresa cuando la migracion ya existe.

## Tablas nuevas

### `sa_plans`

Define planes SaaS con limites y permisos:

- `name`
- `monthly_price`
- `yearly_price`
- `max_catalogs`
- `max_sellers`
- `max_products`
- `storage_gb`
- `allow_custom_domain`
- `allow_backblaze`
- `allow_campaigns`
- `allow_ai`
- `status`

### `sa_company_domains`

Permite asignar dominios y subdominios a empresas:

- `company_id`
- `domain`
- `type`: `subdomain` o `custom_domain`
- `status`: `pending`, `active`, `failed`, `disabled`
- `is_primary`
- `dns_target`
- `ssl_status`
- `verified_at`

## Columnas agregadas a `sa_companies`

La migracion agrega solo si no existen:

- `legal_name`
- `plan_id`
- `expires_at`
- `max_catalogs`
- `max_sellers`
- `max_products`
- `storage_mode`

## Como ejecutar la migracion

En phpMyAdmin o cliente MySQL, ejecutar:

```sql
hosting/sql/20260508_super_admin_connect_companies.sql
```

La migracion es incremental: crea tablas si faltan y agrega columnas solo si no existen.

## Como crear una empresa

1. Entrar al Super Admin.
2. Ir a `Empresas`.
3. Crear o editar una empresa.
4. Completar nombre, slug, contacto, estado, plan, vencimiento y limites si ya corrio la migracion.
5. Guardar.

## Como asignar dominio

1. Ir a `Dominios`.
2. Seleccionar empresa.
3. Registrar dominio, por ejemplo:
   - `cliente.createcgroupsolution.com`
   - `catalogos.cliente.com`
4. Elegir tipo:
   - `subdomain`
   - `custom_domain`
5. Marcar como principal si aplica.
6. Guardar.

## Deteccion por dominio

El helper `hosting/includes/company_context.php` expone:

- `sa_normalize_host($host)`
- `resolve_company_by_host($pdo, $host = null)`
- `get_current_company($pdo)`
- `require_active_company($pdo)`
- `is_legacy_company_context($pdo)`

Primero busca en `sa_company_domains`.
Si no encuentra, revisa `sa_companies.domain` y `sa_companies.subdomain`.
Si no encuentra empresa, devuelve modo `legacy` y no bloquea el sistema actual.

## Probar modo legacy

Desde cualquier dominio no registrado en `sa_company_domains`, el helper debe devolver:

```json
{
  "mode": "legacy",
  "legacy": true,
  "allowed": true
}
```

Esto mantiene funcionando Rodeo Import mientras la migracion multiempresa se hace por fases.

## Probar `validate_license.php`

Endpoint:

```text
POST /catalogos_api/validate_license.php
```

JSON de prueba:

```json
{
  "license_key": "RI-XXXXXXXXXXXX",
  "device_id": "PC-PRUEBA-001",
  "app_version": "1.0.0",
  "company_slug": "mi-empresa"
}
```

Respuesta esperada si la licencia esta activa:

```json
{
  "success": true,
  "company_id": 1,
  "company_name": "Mi Empresa",
  "status": "active",
  "plan": "Profesional",
  "expires_at": "2026-12-31",
  "allowed_publish": true,
  "message": "Licencia valida. Publicacion permitida."
}
```

Este endpoint es opcional. Electron todavia no esta obligado a usarlo y la publicacion actual sigue usando el flujo existente.

## Verificar que Rodeo Import sigue funcionando

1. Entrar al panel admin actual.
2. Entrar al panel vendedor.
3. Abrir un catalogo publico existente.
4. Crear un pedido de prueba.
5. Publicar desde Electron como antes.
6. Confirmar que no se pidio licencia obligatoria.
7. Confirmar que SMTP, FTP y API key no cambiaron.

## Pendiente para la siguiente fase

- Aplicar limites de plan de forma gradual.
- Conectar `company_id` progresivamente a `catalogs`, `orders`, `sellers` y `catalog_users`.
- Separar branding/configuracion por empresa.
- Preparar dominios reales con DNS y SSL automatico.

## Fase 3 agregada

La administracion visual de planes vive en:

```text
hosting/super_admin/plans.php
```

La validacion no bloqueante en Electron se documenta en:

```text
docs/saas_license_electron.md
```

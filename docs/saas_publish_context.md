# Registro SaaS no bloqueante en publicacion

Esta fase registra intentos de publicacion con contexto SaaS sin bloquear el flujo actual.
Rodeo Import sigue publicando aunque no haya licencia, la licencia falle o la API SaaS no responda.

## Migracion

Ejecutar en phpMyAdmin o cliente MySQL:

```sql
hosting/sql/20260509_saas_publish_logs.sql
```

Crea la tabla:

```text
saas_publish_logs
```

## Que guarda el log

- empresa SaaS si se pudo resolver
- slug de empresa
- id de licencia si se encontro
- hash SHA-256 de la licencia
- device_id
- app_version
- endpoint usado
- catalog_slug
- catalog_title
- publish_url
- status: `validated`, `warning` o `legacy`
- allowed_publish
- warning_message
- ip_address
- user_agent

No guarda la licencia completa en texto plano.

## Publicar sin licencia

Si Electron no envia campos SaaS, los endpoints siguen respondiendo como antes:

```json
{
  "ok": true,
  "catalog": {}
}
```

No se agrega bloque `saas` y no se bloquea nada.

## Publicar con licencia valida

Electron envia:

```json
{
  "saas_validation_enabled": true,
  "saas_license_key": "RI-...",
  "saas_company_slug": "rodeoimport",
  "saas_device_id": "desktop-...",
  "saas_app_version": "1.0.0"
}
```

Respuesta esperada:

```json
{
  "ok": true,
  "catalog": {},
  "saas": {
    "mode": "validated",
    "company_id": 1,
    "company_slug": "rodeoimport",
    "allowed_publish": true,
    "message": "Licencia SaaS validada correctamente."
  }
}
```

Electron muestra:

```text
Publicacion registrada con licencia SaaS validada.
```

## Publicar con licencia invalida

La publicacion continua. La respuesta incluye:

```json
{
  "saas": {
    "mode": "warning",
    "allowed_publish": false,
    "message": "Licencia SaaS no encontrada. Publicacion continua en modo legacy."
  }
}
```

Electron muestra:

```text
Publicacion realizada en modo legacy con advertencia SaaS.
```

## Revisar logs

En phpMyAdmin:

```sql
SELECT id, company_id, company_slug, license_id, license_key_hash,
       device_id, app_version, endpoint, catalog_slug, status,
       allowed_publish, warning_message, created_at
FROM saas_publish_logs
ORDER BY id DESC
LIMIT 50;
```

Confirmar que `license_key_hash` tiene 64 caracteres y que no existe una columna con la licencia completa.

## Endpoints integrados

- `hosting/catalogos_api/publish_catalog.php`
- `hosting/catalogos_api/publish_uploaded_zip.php`

Ambos aceptan campos SaaS opcionales. Si no se envian, el comportamiento legacy queda igual.

## Verificar modo legacy

1. Desactivar la validacion SaaS en Electron.
2. Publicar como antes.
3. Confirmar que el catalogo sube correctamente.
4. Confirmar que no aparece error nuevo por licencia.
5. Confirmar que pedidos, vendedor y catalogo publico siguen iguales.

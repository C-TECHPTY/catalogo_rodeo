# OpenClaw Integration - RODE IA

Integracion preparatoria para conectar OpenClaw con `catalogo_rodeo` de forma segura.

Esta carpeta no instala OpenClaw y no conecta WhatsApp real. Define la skill privada **RODE IA**, una politica local de permisos y un cliente API limitado para futuras pruebas.

## Objetivo

RODE IA sera un orquestador comercial que solo podra usar APIs internas permitidas para:

- Consultar precio por ITEM.
- Consultar stock por ITEM.
- Buscar imagen por ITEM.
- Solicitar catalogo por categoria.
- Consultar estado de catalogo.
- Enviar link al WhatsApp del vendedor autorizado.
- Enviar link al correo registrado del vendedor.
- Crear pedido borrador, no pedido final.

## Limites

RODE IA no puede:

- Leer `config.php`.
- Acceder directo a MySQL.
- Acceder directo a FTP.
- Acceder a SAP.
- Modificar SMTP.
- Borrar pedidos.
- Cambiar precios maestros.
- Ver datos de otros vendedores.
- Controlar mouse o teclado.
- Enviar mensajes como Nelson.
- Enviar a terceros no autorizados.
- Pedir claves o credenciales.

## Archivos

```text
openclaw_integration/
  README.md
  .env.example
  policy.json
  guard.js
  rodeo_skill/
    SKILL.md
    rodeoApiClient.js
    actions.md
```

## Prueba Local Sin OpenClaw

Crear un `.env` local a partir de `.env.example`:

```powershell
copy openclaw_integration\.env.example openclaw_integration\.env
```

Para pruebas sin endpoints reales, dejar:

```text
RODEO_MOCK_MODE=true
```

Ejecutar:

```powershell
node openclaw_integration\test_local.js "RODE precio 100-9652"
node openclaw_integration\test_local.js "RODE stock 100-9652"
node openclaw_integration\test_local.js "RODE catalogo vasos"
node openclaw_integration\test_local.js "RODE envialo a mi correo"
```

## Endpoints Seguros En Hosting

Esta fase agrega endpoints internos en `hosting/catalogos_api/`:

```text
whatsapp_auth_check.php
whatsapp_product_query.php
ai_create_catalog_request.php
ai_request_status.php
ai_helpers.php
```

Todos requieren una API key limitada en el header:

```text
X-Rodeo-AI-Key: KEY_LIMITADA
```

La key no se guarda en `config.php`. Debe configurarse en `app_settings`:

```sql
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('rodeo_ai_api_key', 'KEY_LIMITADA_SEGURA')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW();
```

Los endpoints:

- No dan acceso directo a MySQL.
- No dan acceso a FTP.
- No modifican SMTP.
- No crean pedidos finales.
- Registran acciones en `activity_logs`.
- Solo responden a vendedores autorizados por `sellers.phone`.

## Fase Actual

Fase 3/4 crea el cliente API limitado y un script local de simulacion. No hay instalacion de OpenClaw ni ejecucion real de la skill.

## Siguiente Fase

Fase 3 implementara `rodeoApiClient.js` para consumir unicamente endpoints seguros:

- `POST /catalogos_api/whatsapp_auth_check.php`
- `POST /catalogos_api/whatsapp_product_query.php`
- `POST /catalogos_api/ai_create_catalog_request.php`
- `POST /catalogos_api/ai_request_status.php`

Todas las acciones deberan pasar por `guard.js` y `policy.json`.

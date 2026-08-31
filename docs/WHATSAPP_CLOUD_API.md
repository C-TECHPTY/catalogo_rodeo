# WhatsApp Business Platform — Fase 1

Esta fase reemplaza el uso operativo de WhatsApp Web por una integración aislada con la API oficial Cloud API. El bot `whatsapp_bot/` se conserva únicamente como herramienta local heredada y no debe desplegarse como canal de producción.

## Variables privadas

Configura fuera del webroot: `WHATSAPP_ENABLED`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION` (por defecto `v22.0`) y `APP_TIMEZONE=America/Panama`. También pueden definirse en el bloque `whatsapp` de `catalogos_api/config.php`, que está ignorado por Git. Las variables de entorno tienen prioridad.

## Instalación y webhook

1. Ejecuta `hosting/sql/20260827_whatsapp_cloud_phase1.sql` después de las migraciones existentes.
2. Publica `catalogos_api/whatsapp_helpers.php` y `catalogos_api/whatsapp_webhook.php`.
3. En Meta, registra `https://TU-DOMINIO/catalogos_api/whatsapp_webhook.php` como Callback URL y usa el mismo `WHATSAPP_VERIFY_TOKEN`.
4. Suscribe los eventos `messages` y verifica que PHP tenga cURL habilitado.

El `GET` valida el challenge. El `POST` exige `X-Hub-Signature-256`, registra mensajes por ID y descarta duplicados. Los números se normalizan y se resuelven exclusivamente contra `sellers.is_active=1`. Un número no autorizado no recibe información comercial.

## Prueba controlada

`POST /catalogos_api/whatsapp_connection_test.php` con `X-API-Key` y JSON `{"to":"507..."}` envía un texto de prueba. No envíes secretos en el cuerpo. La prueba requiere credenciales reales y `WHATSAPP_ENABLED=true`.

## Rollback

Desactiva `WHATSAPP_ENABLED=false` o quita el webhook desde Meta. Las tablas son aditivas y pueden conservarse como auditoría; no afectan catálogos ni pedidos publicados.

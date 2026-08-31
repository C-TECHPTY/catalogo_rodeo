# OpenAI — Fase 3: interpretación comercial

La IA se usa solo desde `catalogos_api/openai_service.php`; nunca desde Electron, JavaScript público ni con acceso directo a MySQL. La integración usa Responses API con Structured Outputs y `store: false`. El backend valida el JSON y todavía no ejecuta ninguna operación a partir de una intención.

## Configuración privada

Define fuera del webroot `AI_ENABLED=true`, `OPENAI_API_KEY` y opcionalmente `OPENAI_MODEL` (por defecto `gpt-4.1-mini`). También es posible usar el bloque `openai` de `catalogos_api/config.php`, que no se versiona. No envíes teléfonos, tokens, contraseñas ni datos de pedidos a esta ruta: el endpoint solo manda el texto del mensaje.

## Prueba

Con la clave limitada `rodeo_ai_api_key`, llama `POST /catalogos_api/ai_interpret_message.php` con `X-Rodeo-AI-Key` y:

```json
{"sender":"507...","message":"Necesito catálogo de ollas y sartenes al .55"}
```

La respuesta debe incluir `intent: generate_catalog` y `price_factor: 0.55`. Si OpenAI está desactivado, excede límite o falla, devuelve de forma segura `unknown`; no crea catálogos ni modifica datos.

La API usa JSON Schema estricto, formato recomendado para Structured Outputs en la Responses API según la [referencia oficial de OpenAI](https://platform.openai.com/docs/api-reference/responses-streaming/response/content_part).

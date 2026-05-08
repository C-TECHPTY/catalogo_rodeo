# RODE IA Actions

## Permitidas

### auth.checkSeller

Valida que el remitente sea vendedor autorizado.

Endpoint futuro:

```text
POST /catalogos_api/whatsapp_auth_check.php
```

### product.queryPrice

Consulta precio por ITEM.

Endpoint futuro:

```text
POST /catalogos_api/whatsapp_product_query.php
```

### product.queryStock

Consulta disponibilidad por ITEM.

Endpoint futuro:

```text
POST /catalogos_api/whatsapp_product_query.php
```

### product.queryImage

Busca imagen principal por ITEM.

Endpoint futuro:

```text
POST /catalogos_api/whatsapp_product_query.php
```

### catalog.requestByCategory

Solicita o prepara un catalogo por categoria.

Endpoint futuro:

```text
POST /catalogos_api/ai_create_catalog_request.php
```

### catalog.status

Consulta estado de una solicitud de catalogo.

Endpoint futuro:

```text
POST /catalogos_api/ai_request_status.php
```

### seller.sendWhatsAppCatalogLink

Envia link al WhatsApp del vendedor autorizado.

### seller.sendEmailCatalogLink

Envia link al correo registrado del vendedor autorizado.

### order.createDraft

Crea un borrador de pedido. No crea pedido final.

## Bloqueadas

- Crear pedido final.
- Borrar pedidos.
- Modificar precios maestros.
- Leer `config.php`.
- Modificar SMTP.
- Consultar datos de otros vendedores.
- Ejecutar comandos del sistema.
- Controlar mouse o teclado.
- Acceder a MySQL, FTP o SAP directamente.

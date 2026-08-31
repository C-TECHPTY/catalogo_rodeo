# Marketplace Navidad

Plantilla web original para catálogos navideños B2B. Usa una cuadrícula comercial, buscador, categorías horizontales y carrito; no copia la marca, textos ni activos de terceros.

## Uso

En Electron selecciona **Tipo de catálogo: Navidad** y **Plantilla web: Marketplace Navidad**, luego genera y publica un paquete nuevo. Los catálogos ya publicados no cambian hasta volver a generarse.

Para un catálogo de inventario, selecciona **Tipo de catálogo: Navidad Stock**. Este modo activa automáticamente **Marketplace Navidad** y lee un Excel estándar con `ITEM`, `DESCRIPCION`, `PRECIO`, `DISPONIBLE` o `STOCK`; el catálogo público muestra la disponibilidad real y bloquea artículos con valor `0` o `Agotado`.

## Proforma Panamá / Directo

Solo los nuevos paquetes con **Marketplace Navidad** activan el selector en la pantalla **Revisar pedido**. El cliente elige `Precio Panamá` o `Precio Directo`, se recalculan el carrito y la proforma, y la lista queda registrada en el pedido. El servidor vuelve a leer `panamaPrice` o `directPrice` del catálogo publicado y no acepta el precio enviado por el navegador. Ejecuta también `sql/20260828_christmas_price_lists.sql` para guardar la lista en `orders` y `order_items`.

Para categorías exactas, agrega una columna `CATEGORIA` al Excel con valores como `Bolas y adornos`, `Arboles`, `Luces`, `Textil navideno`, `Guirnaldas y coronas` o `Flores navidenas`. Si está vacía, se aplican reglas de respaldo sobre la descripción; los casos no detectados quedan como `Navidad` o la fábrica original.

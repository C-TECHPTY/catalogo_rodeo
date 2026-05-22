# Plantillas por marca

Fase opcional y reversible para aplicar visuales por marca sin cambiar el flujo actual de generacion/publicacion.

## Estructura

Las plantillas viven en:

```text
hosting/assets/brand_templates/{slug}/
```

Ejemplo:

```text
hosting/assets/brand_templates/luxury-home-linens/
  logo.png
  banner.jpg
  promo.jpg
  background.jpg
  placeholder.png
  config.json
```

El `slug` se genera desde la marca del Excel:

- `LUXURY HOME LINER` -> `luxury-home-liner`
- `ACENOX` -> `acenox`
- `Maranelo Christmas` -> `maranelo-christmas`

## config.json

```json
{
  "brand": "LUXURY",
  "slug": "luxury",
  "primaryColor": "#111111",
  "secondaryColor": "#D4AF37",
  "textColor": "#FFFFFF",
  "bannerTitle": "Luxury Home Liner",
  "promoText": "Coleccion premium para el hogar",
  "logo": "logo.png",
  "banner": "banner.jpg",
  "promo": "promo.jpg",
  "background": "background.jpg",
  "placeholder": "placeholder.png"
}
```

Los archivos de imagen son opcionales. Si alguno falta, el catalogo usa el diseno actual o el placeholder global.

## Comportamiento

- Si el Excel trae columna `MARCA`, cada producto conserva su marca y `brandSlug`.
- Si el catalogo tiene mas de una marca real, el JSON incluye `brandFilterEnabled: true` y una lista `brands`.
- Si el catalogo tiene una sola marca real, el JSON incluye `brandFilterEnabled: false` y `activeBrand`.
- En modo `Solo una marca`, el titulo visual del preview y del catalogo publicado usa primero la marca seleccionada o el `bannerTitle` de su plantilla. El campo general del catalogo no se cambia.
- Al exportar/publicar, Electron busca plantillas que coincidan con las marcas del catalogo.
- Si encuentra `config.json`, copia esa carpeta al paquete exportado en:

```text
assets/brand_templates/{slug}/
```

- Tambien agrega metadata `brandTemplates` dentro de `catalog.json`.
- Los assets visuales de marca, como logo, cover y fondo, se copian al paquete aunque las imagenes de productos se suban a Backblaze.
- Si una marca no tiene plantilla, usa el diseno actual.
- Si el Excel no trae columna `MARCA`, todo sigue funcionando como antes.

## Logo en el catalogo publicado

El logo que se ve en el header publico debe llegar como archivo independiente dentro del paquete generado. Puede venir de:

- el preset visual guardado en Electron para esa marca;
- el archivo `logo.png` definido en `brand_templates/{slug}/config.json`;
- el logo general seleccionado manualmente.

Si un catalogo ya esta publicado y no muestra logo, no basta con subir CSS. Hay que regenerar y volver a publicar el catalogo desde Electron para que el paquete incluya el nuevo `catalog.json` y el archivo de logo.

## Placeholder sin foto

Si un producto no tiene imagen:

1. usa `placeholder.png` de la marca si existe;
2. si no existe, usa:

```text
assets/img/no-photo-camera.svg
```

## Admin

Pantalla de solo lectura:

```text
catalogos_admin/brand_templates.php
```

Muestra plantillas detectadas, colores, logo y estado. No edita archivos ni toca base de datos.

## Rollback

Para desactivar la fase:

- no crear carpetas en `brand_templates`; o
- eliminar la carpeta de una marca especifica.

El catalogo vuelve al diseno por defecto sin modificar pedidos, links, vendedores, SMTP ni configuracion real.

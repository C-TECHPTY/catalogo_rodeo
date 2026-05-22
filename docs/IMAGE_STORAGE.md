# Configuracion de almacenamiento de imagenes

El proyecto conserva el flujo actual del hosting como comportamiento por defecto, pero ya incluye soporte opcional para Backblaze B2/CDN en el panel del hosting.

## Configuracion local de la app Electron

Variables opcionales para el flujo local/app:

```env
IMAGE_STORAGE_MODE=hosting
IMAGE_CDN_BASE_URL=
B2_BUCKET_NAME=
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_ENDPOINT=
```

Modes:
Modos:

- `hosting`: comportamiento actual. Las imagenes se copian dentro del paquete del catalogo y se sirven desde el hosting.
- `backblaze`: se prefieren URLs remotas/CDN.
- `hybrid`: se prefieren URLs remotas/CDN, con fallback al path local del hosting.

Notas de seguridad:

- Mantener credenciales reales solo en `.env`, configuracion local o `catalogos_api/config.php` privado.
- No commitear `.env`, claves Backblaze, secretos del bucket ni `config.php` de produccion.
- Los archivos example son solo plantillas y no deben contener secretos reales.

## Configuracion en hosting PHP

Para que las imagenes subidas desde el panel admin vayan directo a Backblaze/CDN, agregar en `catalogos_api/config.php`:

```php
'backblaze' => [
    'enabled' => true,
    'endpoint' => 'https://s3.us-west-004.backblazeb2.com',
    'region' => 'us-west-004',
    'bucket' => 'NOMBRE_DEL_BUCKET',
    'key_id' => 'B2_KEY_ID',
    'application_key' => 'B2_APPLICATION_KEY',
    'cdn_base_url' => 'https://rodeo-catalogos-img.b-cdn.net',
    'timeout' => 45,
],
```

Si `enabled` queda en `false`, el sistema guarda imagenes en el hosting local como antes.

## Backblaze setup

Configuracion recomendada del bucket:

- Bucket type: `Public`
- Object Lock: disabled
- Default encryption: opcional; desactivado mantiene el flujo publico/CDN mas simple
- Endpoint ejemplo: `https://s3.us-west-004.backblazeb2.com`

Crear una application key limitada al bucket de imagenes con permisos de lectura/escritura. Recomendacion: usar prefijo `catalogos/` para que la llave solo trabaje dentro de esa ruta.

Ejemplo local `.env`:

```env
IMAGE_STORAGE_MODE=hybrid
IMAGE_CDN_BASE_URL=https://rodeo-catalogos-img.b-cdn.net
B2_BUCKET_NAME=rodeo-catalogos-img
B2_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_private_application_key
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
```

## Uso desde el panel admin

Pantalla:

```text
catalogos_admin/catalog_update_images.php
```

Funciones:

- actualizar imagen por ITEM;
- subir a Backblaze/CDN si esta habilitado;
- guardar en hosting local si Backblaze esta deshabilitado;
- crear miniatura para imagen nueva;
- generar miniaturas faltantes para imagenes existentes.

Rutas usadas en Backblaze:

```text
catalogos/{slug}/updates/{ITEM-fecha}.jpg
catalogos/{slug}/updates/thumbs/{ITEM-fecha}.webp
```

## CDN

`cdn_base_url` o `IMAGE_CDN_BASE_URL` debe ser la URL publica que sirve archivos desde el bucket. Puede ser:

- URL publica directa de Backblaze.
- Pull Zone de Bunny CDN.
- Dominio personalizado apuntando al CDN.

Ejemplo con Bunny:

```text
https://rodeo-catalogos-img.b-cdn.net/catalogos/{slug}/updates/ITEM-20260515.jpg
```

## Rollback seguro

Para volver al flujo local:

```env
IMAGE_STORAGE_MODE=hosting
```

Y en `catalogos_api/config.php`:

```php
'backblaze' => [
    'enabled' => false,
],
```

Las imagenes que ya existen en el hosting local siguen funcionando. Las imagenes ya subidas a Backblaze/CDN tambien siguen disponibles mientras el bucket/CDN exista.

# Actualizacion de catalogos y Backblaze desde Windows

## Respaldo

Antes de esta implementacion se creo una copia integral fuera del proyecto:

`C:\Users\nsanchez\Desktop\catalogo rodeo html\copia de seguridad del sistema-20260826-091742`

La copia contiene todos los archivos del proyecto, dependencias y releases anteriores. No falta ningun archivo respecto al origen al momento de la verificacion.

## Actualizar un catalogo existente

1. Abre **Catalogo Rodeo B2B**.
2. Usa exactamente el mismo slug del catalogo publicado.
3. Carga el Excel nuevo.
4. Selecciona o actualiza el indice de la carpeta maestra de imagenes.
5. Pulsa **Analizar Excel contra publicado**.
6. Revisa productos nuevos, modificados, ausentes y productos sin imagen.
7. Pulsa **Publicar / actualizar existente**.

El slug y el enlace publico se mantienen. El paquete del catalogo se reconstruye de forma local y se publica sobre el catalogo seleccionado. Los ITEM nuevos del Excel se incluyen con sus datos e imagenes cuando el archivo de imagen coincide con el ITEM.

La aplicacion no elimina automaticamente productos ausentes del Excel durante el analisis. La publicacion refleja el contenido seleccionado y filtrado en la aplicacion, por lo que se debe revisar el resumen antes de confirmar.

## Actualizacion de imagenes en Backblaze

La publicacion conserva las rutas actuales `{slug}/{archivo}` para no romper catalogos existentes.

- Si el contenido local y remoto es igual, la subida se omite.
- Si el contenido cambio aunque conserve el mismo nombre, se realiza un nuevo `PUT`.
- La URL publicada recibe `?v={hash}` para evitar que el CDN o el navegador conserve la imagen anterior.
- El log indica `SIN CAMBIOS`, `SUBIDA` o `REEMPLAZADA`.

Backblaze puede conservar versiones anteriores del mismo objeto. Estas versiones se administran desde **Sincronizacion y mantenimiento**.

## Configuracion segura de Backblaze

Configura en la aplicacion:

- URL CDN.
- Nombre del bucket.
- Key ID.
- Application key.
- Endpoint S3.

La Application key se almacena cifrada mediante `safeStorage` en el archivo de configuracion de Windows. El instalador no incluye `.env` ni credenciales.

Se recomienda crear una key limitada exclusivamente al bucket de catalogos. Para usar limpieza de versiones debe tener permisos de listado de versiones y eliminacion. No uses una key con acceso a todos los buckets de la cuenta.

## Mantenimiento seguro

1. Carga el Excel y las imagenes del catalogo que vas a revisar.
2. Escribe el slug exacto.
3. Pulsa **Analizar catalogo actual**.
4. Revisa las cantidades de imágenes activas, versiones anteriores y archivos sin uso.
5. Pulsa **Limpiar seleccion segura** solamente después de revisar el resumen.

Protecciones:

- No se admite un prefijo vacio.
- La operacion queda limitada al slug seleccionado.
- Solo se eliminan `key + versionId` devueltos por el analisis previo.
- El maximo es 5000 versiones por operacion.
- Se requiere confirmacion explicita.
- No existe una accion para vaciar el bucket completo.

Las imagenes se consideran sin uso comparando los nombres del paquete que produciria el Excel actual con los objetos del prefijo del catalogo. Por seguridad, carga el Excel correcto y no limpies un catalogo mientras otra persona lo esta publicando.

## Instalador

Generar el instalador:

```powershell
npm.cmd run dist:win
```

Resultado:

`installer-output\Catalogo-Rodeo-B2B-Setup-1.0.0-x64.exe`

El instalador es por usuario, permite seleccionar carpeta, crea accesos directos y conserva los datos ubicados en `%LOCALAPPDATA%\Catalogo Rodeo B2B` durante actualizaciones y desinstalaciones.

## Recuperacion

Si se necesita volver al estado anterior, cierra la aplicacion y recupera los archivos desde la carpeta de respaldo. No borres `%LOCALAPPDATA%\Catalogo Rodeo B2B` si deseas conservar configuracion e indices locales.

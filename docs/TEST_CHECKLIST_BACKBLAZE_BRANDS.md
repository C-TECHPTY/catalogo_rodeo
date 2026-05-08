# Checklist de pruebas - Backblaze B2, modo hibrido y marcas

Ejecutar estas pruebas primero en ambiente local o staging, no directamente en produccion.

## 1. Catalogo normal con imagenes hosting

- En la app, seleccionar `Almacenamiento de imagenes: Hosting actual`.
- Cargar Excel existente sin cambios.
- Cargar carpeta de imagenes local.
- Generar vista previa, exportar PDF y exportar paquete web.

Resultado esperado:

- Las imagenes salen desde rutas locales del paquete `media/...`.
- El catalogo se ve como antes.
- No se requiere Backblaze.

## 2. Catalogo con imagenes Backblaze

- Seleccionar `Almacenamiento de imagenes: Backblaze B2/CDN`.
- Confirmar que `.env` local tiene bucket, endpoint, CDN y credenciales.
- Exportar paquete web.

Resultado esperado:

- Se crea `logs/backblaze-upload.log`.
- `catalog.json` incluye `remote_image_url`.
- En Backblaze aparecen archivos bajo `catalogos/{slug}/`.
- El catalogo carga imagenes desde la URL CDN/publica.

## 3. Catalogo hibrido

- Seleccionar `Almacenamiento de imagenes: Hibrido recomendado`.
- Exportar paquete web.
- Probar con algunas imagenes subidas y otras no disponibles.

Resultado esperado:

- Si existe URL remota, el catalogo la usa primero.
- Si falla la URL remota, usa la imagen local del hosting.
- El proceso no se detiene por errores de Backblaze.

## 4. Excel sin columna MARCA

- Cargar un Excel antiguo sin `MARCA`.
- Generar catalogo completo.

Resultado esperado:

- No aparecen filtros vacios de marca.
- No se muestran marcas vacias en tarjetas ni detalle.
- El flujo anterior sigue intacto.

## 5. Excel con columna MARCA

- Cargar Excel con `MARCA`.
- Generar catalogo completo.

Resultado esperado:

- `catalog.json` incluye `brand`.
- La tarjeta y detalle muestran marca cuando existe.
- El frontend muestra filtro de marca si hay mas de una marca.

## 6. Catalogo completo

- En `Generacion por marca`, seleccionar `Catalogo completo`.
- Exportar paquete.

Resultado esperado:

- Incluye todos los productos filtrados solo por entrada, si aplica.
- El slug base no cambia por marca.

## 7. Catalogo por marca

- En `Generacion por marca`, seleccionar `Solo una marca`.
- Elegir una marca, por ejemplo `FINE CASA`.
- Exportar paquete.

Resultado esperado:

- Solo incluye productos de esa marca.
- El slug es seguro, por ejemplo `catalogo-publicable-fine-casa`.

## 8. Varios catalogos separados por marca

- En `Generacion por marca`, seleccionar `Separados por marca`.
- Exportar paquete local.

Resultado esperado:

- Se crea un paquete por marca.
- Las marcas usan slugs seguros:
  - `ACENOX` -> `acenox`
  - `FINE CASA` -> `fine-casa`

## 9. Pedido generado correctamente

- Abrir catalogo publicado con link seguro.
- Agregar productos al carrito.
- Enviar pedido.

Resultado esperado:

- El pedido se registra.
- Las lineas conservan item, descripcion, precio, empaque e imagen.
- El panel admin/vendedor muestra el pedido.

## 10. PDF/XLSX generado correctamente

- Desde el admin o pedido, exportar PDF/XLSX.

Resultado esperado:

- El archivo se descarga.
- Las imagenes remotas se intentan incrustar cuando son HTTPS.
- Si una imagen no carga, se conserva fallback/no-image sin romper el archivo.

## 11. Links seguros funcionando

- Crear link seguro por vendedor/cliente.
- Abrir catalogo con token.
- Probar token vencido o invalido.

Resultado esperado:

- Token valido permite ver y comprar.
- Token invalido/vencido bloquea el catalogo.

## 12. SMTP intacto

- Enviar pedido de prueba.
- Revisar notificacion por correo.

Resultado esperado:

- No cambia configuracion SMTP.
- El correo sigue usando la configuracion existente en `catalogos_api/config.php`.

## Rollback rapido

- En la app, volver a `Almacenamiento de imagenes: Hosting actual`.
- Si se necesita desactivar Backblaze completamente, cambiar `.env` local a:

```env
IMAGE_STORAGE_MODE=hosting
```

- Volver a exportar/publicar el catalogo.

Resultado esperado:

- El sistema vuelve al flujo de hosting/local anterior.

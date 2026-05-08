# Monitoreo de publicaciones SaaS

Esta fase agrega un panel de solo lectura para revisar los registros guardados en `saas_publish_logs`. No bloquea publicaciones, no cambia FTP, no cambia API keys y no convierte todavia el sistema a multiempresa obligatorio.

## Archivos principales

- `hosting/super_admin/publish_logs.php`: panel de monitoreo y exportacion CSV.
- `hosting/super_admin/dashboard.php`: tarjetas resumen de publicaciones SaaS.
- `hosting/super_admin/includes/sidebar.php`: enlace "Publicaciones SaaS".
- `hosting/sql/20260509_saas_publish_logs.sql`: tabla usada por el panel.

## Activar el panel

1. Subir los archivos PHP modificados al hosting.
2. Ejecutar una sola vez la migracion:

```sql
SOURCE hosting/sql/20260509_saas_publish_logs.sql;
```

En cPanel/phpMyAdmin tambien se puede abrir el archivo SQL, copiar su contenido y ejecutarlo en la base de datos del sistema.

Si la tabla todavia no existe, el dashboard no debe fallar; mostrara el aviso:

```text
Ejecuta la migracion de logs SaaS para activar este panel.
```

## Como revisar publicaciones

Entrar al Super Admin y abrir:

```text
/super_admin/publish_logs.php
```

O usar el enlace del menu lateral:

```text
Publicaciones SaaS
```

El panel muestra:

- fecha de publicacion
- empresa y `company_slug`
- `license_id`
- hash parcial de licencia
- `device_id`
- version de app
- endpoint usado
- catalogo publicado
- URL publica
- estado
- mensaje o advertencia
- IP

La licencia completa no se muestra ni se guarda en texto plano.

## Filtros

El panel permite filtrar por:

- empresa
- estado: `validated`, `warning`, `legacy`, `blocked`
- busqueda por catalogo, URL o `device_id`

Tambien tiene paginacion simple de 25 registros por pagina.

## Exportar CSV

Usar el boton:

```text
Exportar CSV
```

El CSV respeta los filtros activos y exporta:

- `created_at`
- `company_slug`
- `license_id`
- `device_id`
- `app_version`
- `endpoint`
- `catalog_slug`
- `catalog_title`
- `publish_url`
- `status`
- `allowed_publish`
- `warning_message`
- `ip_address`

## Significado de estados

- `validated`: la licencia SaaS fue validada y la publicacion se registro correctamente.
- `warning`: la publicacion continuo en modo legacy, pero hubo una advertencia SaaS, por ejemplo licencia invalida, empresa vencida o endpoint no disponible.
- `legacy`: publicacion sin contexto SaaS o con validacion desactivada.
- `blocked`: reservado para una fase futura. En esta fase no se bloquea la publicacion.

## Como confirmar que funciona

1. Publicar un catalogo sin SaaS activo.
2. Revisar que el catalogo se publique como siempre.
3. Publicar con SaaS activo y licencia valida.
4. Entrar a `publish_logs.php`.
5. Confirmar que aparece un registro con `status = validated`.
6. Probar una licencia incorrecta.
7. Confirmar que el catalogo se publica igual y que el registro queda como `warning`.
8. Exportar CSV y verificar que solo aparece el hash parcial, no la licencia completa.

## Pendiente para futuras fases

- Aplicar limites reales por plan.
- Bloquear publicacion cuando una empresa este suspendida o vencida.
- Asociar catalogos, vendedores, clientes y pedidos a `company_id`.
- Agregar reportes por empresa y periodo.
- Integrar dominios de empresa con catálogos en modo multiempresa completo.

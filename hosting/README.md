# Hosting Bundle

Esta carpeta contiene la base para subir el sistema al hosting:

- `sql/catalog_platform.sql`: crea la base de datos y tablas.
- `catalogos_api/`: scripts PHP para publicar catalogos, validar vigencia y recibir pedidos.
- `catalogos_admin/`: panel basico para ver catalogos y pedidos.

## Estructura recomendada en cPanel

```text
public_html/
  catalogos/
  catalogos_api/
  catalogos_admin/
```

## Pasos de despliegue

1. Importa `sql/catalog_platform.sql` en MySQL.
2. Copia `catalogos_api/config.example.php` como `catalogos_api/config.php`.
3. Completa credenciales de base de datos, API key y correos.
4. Sube `catalogos_api/` a `public_html/catalogos_api/`.
5. Sube `catalogos_admin/` a `public_html/catalogos_admin/`.
6. Usa el programa local para exportar el paquete web del catalogo.
7. Sube cada catalogo a `public_html/catalogos/<slug>/`.

## Nota importante

El panel ya funciona con login por base de datos, pero debes cambiar el hash del usuario `admin` por uno generado con `password_hash()` antes de ponerlo en produccion.

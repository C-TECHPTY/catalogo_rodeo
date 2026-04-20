# Catalogo Rodeo B2B

Bundle web listo para hosting con:

- API PHP segura en `catalogos_api/`
- panel admin en `catalogos_admin/`
- panel vendedor en `catalogos_vendedor/`
- assets compartidos en `assets/`
- SQL base en `sql/catalog_platform.sql`
- migracion evolutiva en `sql/20260418_b2b_upgrade.sql`

## Estructura sugerida

```text
public_html/
  catalogos/
  catalogos_api/
  catalogos_admin/
  catalogos_vendedor/
  assets/
```

## Instalacion rapida

1. Importa `sql/catalog_platform.sql` si es instalacion nueva.
2. Si ya existe una base previa, ejecuta `sql/20260418_b2b_upgrade.sql`.
3. Copia `catalogos_api/config.example.php` como `catalogos_api/config.php`.
4. Ajusta credenciales MySQL, `api_key`, correo remitente y zona horaria.
5. Sube `catalogos_api/`, `catalogos_admin/`, `catalogos_vendedor/` y `assets/`.
6. Mantén `sql/` fuera del acceso publico si el hosting lo permite.
7. Publica los catalogos generados por Electron dentro de `catalogos/<slug>/`.

## Usuario inicial

- usuario: `admin`
- clave temporal: `AdminRodeo2026!`
- cambia el hash de `catalog_users.password_hash` antes de produccion

## Recomendaciones de produccion

- PHP 8.1 o superior
- MySQL 8.0+ o MariaDB 10.6+
- `ZipArchive` habilitado
- `mail()` funcional o relay SMTP del hosting
- HTTPS obligatorio
- cambia `api_key` y hash admin antes de exponer el sistema

## Correo SMTP

Si cPanel bloquea `mail()` con errores como `550 5.7.1 EASender blocked`,
configura SMTP autenticado en `catalogos_api/config.php`:

```php
'mail' => [
    'from_name' => 'Rodeo Import',
    'from_email' => 'catalogos@rodeoimportzl.com',
    'smtp' => [
        'enabled' => true,
        'host' => 'mail.rodeoimportzl.com',
        'port' => 465,
        'encryption' => 'ssl',
        'username' => 'catalogos@rodeoimportzl.com',
        'password' => 'CLAVE_DEL_CORREO',
        'timeout' => 20,
    ],
],
```

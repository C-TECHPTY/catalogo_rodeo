# Licencia SaaS opcional en Electron

Esta fase agrega administracion visual de planes SaaS y validacion opcional de licencia en la app Electron.
La publicacion actual no queda bloqueada.

## Crear un plan

1. Entrar al Super Admin.
2. Ir a `Planes SaaS`.
3. Completar:
   - nombre
   - precio mensual/anual
   - maximo de catalogos
   - maximo de vendedores
   - maximo de productos
   - permisos: dominio propio, Backblaze, campanas, IA
4. Guardar.

Los planes se guardan en `sa_plans`. Para no romper empresas existentes, no se eliminan planes desde el panel: se activan o desactivan.

## Asignar plan a empresa

1. Ir a `Empresas`.
2. Crear o editar empresa.
3. Seleccionar el plan desde el campo `Plan`.
4. Guardar.

El plan queda en `sa_companies.plan_id`. Todavia no aplica limites reales a catálogos, pedidos o vendedores.

## Crear licencia

1. Ir a `Licencias`.
2. Seleccionar empresa.
3. Dejar clave vacia para generar una clave automatica o pegar una clave propia.
4. Estado: `Activo`.
5. Definir fecha de vencimiento y limites si aplica.
6. Guardar.

## Probar endpoint de licencia

Endpoint:

```text
POST /catalogos_api/validate_license.php
```

JSON:

```json
{
  "license_key": "RI-TU-LICENCIA",
  "device_id": "PC-PRUEBA",
  "app_version": "1.0.0",
  "company_slug": "rodeoimport"
}
```

Si la licencia esta activa, responde `success: true` y `allowed_publish: true`.

## Configurar Electron

En la app de escritorio:

1. Abrir `Publicacion web`.
2. En `Licencia SaaS`, activar `Validar licencia antes de publicar, sin bloquear modo legacy`.
3. Pegar la clave en `Clave licencia SaaS`.
4. Colocar el slug de empresa, por ejemplo `rodeoimport`.
5. Colocar `API SaaS`, por ejemplo:

```text
https://rodeoimportzl.com/catalogos_api
```

6. Presionar `Probar licencia SaaS`.

La configuracion se guarda en el mismo `settings.json` local de Electron. La clave SaaS se trata como secreto local, igual que FTP y API key.

## Comportamiento no bloqueante

Si valida correctamente:

```text
Licencia SaaS validada correctamente.
```

Si falla:

```text
No se pudo validar la licencia SaaS. Continuando en modo legacy.
```

La publicacion continua. Todavia no se bloquea Electron, aunque la licencia falle o la API no responda.

## Volver a modo legacy

Desactivar el checkbox:

```text
Validar licencia antes de publicar, sin bloquear modo legacy
```

Tambien puedes limpiar la configuracion local desde `Limpiar configuracion`.

## Pruebas recomendadas

- Crear plan.
- Editar plan.
- Desactivar y activar plan.
- Asignar plan a empresa.
- Ver plan y limites en `Empresas`.
- Probar `validate_license.php` con licencia correcta.
- Probar con licencia incorrecta.
- Activar validacion SaaS en Electron.
- Publicar con licencia correcta.
- Publicar con licencia incorrecta.
- Apagar temporalmente la API y confirmar que Electron sigue en modo legacy.

# 07 · Menú

Administra las opciones de la barra lateral (sidebar). Cada opción es una fila de la tabla `menu`; la barra se arma con las opciones **activas**, ordenadas por `orden`, agrupadas por `apartado` y filtradas por los permisos del rol.

## Campos

| Campo | Regla | Ejemplo |
|---|---|---|
| Apartado | Obligatorio, 3–45. Se guarda con mayúscula inicial por palabra. Agrupa opciones en la barra | `Administración` |
| Menú | Obligatorio, 3–45, **único**. Mayúscula inicial por palabra. Es el nombre que usan los permisos | `Roles` |
| Ruta | Obligatoria, máx. 150, **única**. Minúsculas, números y guiones, empieza por `/` (`/^\/[a-z0-9]+(-[a-z0-9]+)*(\/…)*$/`) | `/roles`, `/admin/roles` |
| Ícono | Obligatorio, 3–45. Clase de [PrimeIcons](https://primeng.org/icons) | `pi pi-shield` |
| Orden | Obligatorio, entero, **único**. Posición en la barra (ascendente) | `2` |
| Estado | Solo al editar: Activo (1) / Inactivo (0). Inactiva no sale en la barra | `1` |
| Descripción | Opcional, 3–255. Primera letra en mayúscula | — |

Duplicados de menú, ruta u orden se rechazan con 409 ("Ya existe una opción de menú con ese nombre / esa ruta / ese orden."). Solo cuentan las opciones no eliminadas (activas o inactivas): el nombre, la ruta y el orden de una opción eliminada quedan libres. Ver [02-base-de-datos](02-base-de-datos.md#tablas).

## Menú inicial (seed)

| Orden | Apartado | Menú | Ruta | Ícono |
|---|---|---|---|---|
| 1 | Administración | Configuración | `/configuracion` | `pi pi-cog` |
| 2 | Administración | Roles | `/roles` | `pi pi-shield` |
| 3 | Administración | Menu | `/menu` | `pi pi-sitemap` |
| 4 | Administración | Permisos | `/permisos` | `pi pi-lock` |
| 5 | Administración | Usuarios | `/usuarios` | `pi pi-users` |
| 6 | Administración | Novedades | `/novedades` | `pi pi-megaphone` |
| 7 | Control | Informe | `/informes` | `pi pi-chart-bar` |
| 8 | Operación | Soporte | `/soporte` | `pi pi-wrench` |

El seed crea cada opción solo si su ruta no existe.

## Relación con permisos

- El campo **Menú** es la llave que une la opción con sus permisos (`permisos.menu`). Al crear un permiso se exige que el valor sea igual al de una opción de menú **activa** (ver [05-permisos](05-permisos.md)).
- El backend (`@RequierePermiso`) y las rutas del frontend (`permisoGuard`) usan los nombres fijos del seed: `Configuración`, `Roles`, `Menu`, `Permisos`, `Usuarios`, `Novedades`, `Informe`, `Soporte`. **Renombrar una opción sembrada rompe sus permisos** y su pantalla.
- La barra muestra una opción solo si el rol tiene **Consultar** sobre ese menú.
- Una opción nueva creada aquí aparece en la barra (con su permiso Consultar), pero solo lleva a una pantalla si esa ruta existe en `frontend/src/app/app.routes.ts`; si no, el router redirige al inicio.

## Qué ve cada rol (seed)

| Rol | Opciones en la barra |
|---|---|
| Super Administrador | Las 8 |
| Administrador | Todas menos Configuración |
| Desarrollador(a) | Novedades (Administración), Informe (Control), Soporte (Operación) |
| Aprendiz Sena | Informe (Control) |

Desarrollador(a) tiene además `Usuarios → Opciones`, que no es Consultar: Usuarios no aparece en su barra. Igual Aprendiz Sena con `Novedades → Opciones` (alimenta el filtro por novedad del Informe): Novedades no aparece en su barra.

## Reglas

- La opción **Configuración** (ruta `/configuracion`) solo la edita o elimina el Super Administrador; tampoco otro rol puede asignar la ruta `/configuracion` al editar una opción (403). Al crear, solo lo impide la unicidad de la ruta (409 mientras exista la opción Configuración). En la tabla, a los demás se les ocultan los botones de esa fila.
- Crear, editar y eliminar exigen `Menu → Crear / Editar / Eliminar`; listar y consultar, `Menu → Consultar`.
- Eliminar es lógico: `estado_registro = 0` y `fecha_eliminacion` (soft delete).
- Inactivar una opción la oculta de la barra y de los menús válidos para crear permisos, pero **no** bloquea la API ni la ruta: eso depende de los permisos.
- La columna **Responsable** es el nombre completo del último usuario que modificó la fila.

## Endpoints (`/api/menu`)

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/activos` | Cualquier usuario autenticado | Opciones activas por `orden` ASC: arma la barra y el select de Permisos |
| GET | `/` | Menu → Consultar | Listado paginado (`page`, `limit`), más recientes primero |
| GET | `/:id` | Menu → Consultar | Una opción |
| POST | `/` | Menu → Crear | Crea (siempre activa) |
| PATCH | `/:id` | Menu → Editar | Actualiza campos enviados |
| DELETE | `/:id` | Menu → Eliminar | Soft delete |

## Código

| Qué | Dónde |
|---|---|
| Entidad, servicio, controlador, DTOs | `backend/src/modules/menu/` |
| Regla de Configuración (`RUTA_CONFIGURACION`, `exigirSuperAdministrador`) | `backend/src/common/auth/jerarquia-roles.util.ts` |
| Nombres fijos de los menús (`ModuloPermiso`) | `backend/src/modules/permisos/permiso.entity.ts` |
| Seed (`MENU_FINAL`) | `backend/src/database/seeds/run-seed.ts` |
| Pantalla de administración | `frontend/src/app/features/menu/` |
| Barra lateral | `frontend/src/app/shared/nav-bar/` |
| Rutas y `permisoGuard` | `frontend/src/app/app.routes.ts`, `frontend/src/app/core/guards/permiso.guard.ts` |

# 05 · Permisos

## Modelo

Cada permiso es una fila de la tabla `permisos`: **rol + menú + acción**. La fila es la fuente de verdad: el backend nunca decide por el nombre del rol (salvo las excepciones de [04-roles-y-jerarquia](04-roles-y-jerarquia.md)).

| Columna | Qué guarda |
|---|---|
| `id_rol` | Rol dueño del permiso (FK a `roles`) |
| `menu` | Nombre de una opción de menú **activa**, idéntico a `menu.menu` (ej. `Roles`, `Informe`) |
| `permiso` | Acción: `Crear`, `Editar`, `Eliminar`, `Consultar` u `Opciones` |
| `estado_registro` | 1 = activo (cuenta), 0 = inactivo (no cuenta) |
| `descripcion`, `id_usuario`, fechas | Campos comunes de auditoría |

### Módulos (`ModuloPermiso`)

Enum en `backend/src/modules/permisos/permiso.entity.ts`. Fija el valor de los 9 menús del seed y el de cada `@RequierePermiso(...)`. El campo `menu` **no** se valida contra este enum sino contra las opciones de menú activas (un menú nuevo creado en [07-menu](07-menu.md) se puede usar en Permisos).

| Enum | Valor (`menu`) |
|---|---|
| `ROLES` | `Roles` |
| `PERMISOS` | `Permisos` |
| `USUARIOS` | `Usuarios` |
| `NOVEDADES` | `Novedades` |
| `CONFIGURACION` | `Configuración` |
| `SOPORTE` | `Soporte` |
| `INFORMES` | `Informe` (singular) |
| `TABLERO` | `Tablero` |
| `MENU` | `Menu` (sin tilde) |

Si se renombra una opción de menú, sus permisos y los `@RequierePermiso` dejan de coincidir.

### Acciones (`AccionPermiso`)

| Acción | Significa |
|---|---|
| Crear | Crear registros de la pantalla |
| Editar | Editar (en Soporte también ejecutar) |
| Eliminar | Borrado lógico |
| Consultar | Ver la pantalla: listado y detalle. También muestra la opción en el menú lateral y habilita la ruta. |
| Opciones | Cargar la lista del módulo en **selects de otras vistas** (`GET /<modulo>/opciones`), sin ver la pantalla del módulo |

### Acciones válidas por menú (`ACCIONES_POR_MENU`)

| Menú | Acciones permitidas |
|---|---|
| Roles, Usuarios, Novedades | Crear, Editar, Eliminar, Consultar, **Opciones** |
| Informe | Solo **Consultar** (listar, resumir y exportar) |
| Tablero | Solo **Consultar** (indicadores y opciones de su filtro) |
| Demás (Configuración, Soporte, Permisos, Menu y menús nuevos) | Crear, Editar, Eliminar, Consultar |

La vista Permisos solo ofrece las acciones válidas del menú elegido (si se cambia el menú y la acción ya no aplica, se limpia); el backend rechaza las demás con **400** "El menú X solo admite: …". El frontend replica la tabla en `features/permisos/permisos.component.ts`.

## Matriz inicial (seed, 73 permisos)

`backend/src/database/seeds/run-seed.ts` (`MATRIZ_PERMISOS`). El seed solo crea las filas que faltan; no borra ni reactiva.

| Menú | Super Administrador | Administrador | Desarrollador(a) | Aprendiz Sena |
|---|---|---|---|---|
| Configuración | CRUD | — | — | — |
| Roles | CRUD + Opciones | CRUD + Opciones | — | — |
| Menu | CRUD | CRUD | — | — |
| Permisos | CRUD | CRUD | — | — |
| Usuarios | CRUD + Opciones | CRUD + Opciones | Opciones | — |
| Novedades | CRUD + Opciones | CRUD + Opciones | Crear, Editar, Consultar, Opciones | Opciones |
| Tablero | Consultar | Consultar | — | — |
| Informe | Consultar | Consultar | Consultar | Consultar |
| Soporte | CRUD | CRUD | Crear, Editar, Consultar | — |
| **Total** | **33** | **29** | **9** | **2** |

CRUD = Crear, Editar, Eliminar, Consultar. Super Administrador y Administrador reciben todas las acciones válidas de cada menú (`accionesPermitidas`), el Administrador sin Configuración.

## Cómo se aplican (backend)

1. `@RequierePermiso(ModuloPermiso.X, AccionPermiso.Y)` en el método del controller (`common/auth/requiere-permiso.decorator.ts`) guarda la metadata.
2. `PermisosGuard` (global, después de `JwtAuthGuard` y `RolesGuard`; `common/auth/permisos.guard.ts`) busca una fila `permisos` con `id_rol` = `idRol` del token, ese `menu`, esa `acción` y `estado_registro = 1` (excluye las eliminadas).
3. Si no existe → **403** "No tienes permiso para realizar esta acción.".
4. Sin `@RequierePermiso`, el guard deja pasar (el endpoint solo exige sesión, o nada si es `@Public()`).

La consulta es por petición: un cambio de permisos rige en el backend de inmediato, sin volver a entrar.

## Cómo los usa el frontend

`frontend/src/app/core/services/permisos.service.ts`

- `cargar()` pide `GET /api/permisos/mis-permisos` al iniciar sesión, al renovar la sesión, al abrir/recargar la app (antes de la primera ruta) y cuando otra pestaña cambia de usuario. No se carga mientras falte el cambio de contraseña obligatorio.
- `tiene(menu, accion)` → `true` si existe la pareja en la lista cargada.
- `esperarCarga()` la usan los guards para no decidir antes de que termine la carga.

| Dónde | Uso |
|---|---|
| `permisoGuard(modulo)` en `app.routes.ts` | Cada ruta exige `Consultar` de su menú; si no, redirige a `/` |
| Menú lateral (`shared/nav-bar`) | Muestra una opción de `/api/menu/activos` solo si hay `Consultar` sobre ella |
| Botones de cada pantalla | `Nuevo` = `Crear`, lápiz = `Editar`, papelera = `Eliminar` (Roles, Permisos, Usuarios, Novedades, Menu, Configuración); Soporte solo condiciona `Nuevo`; Informes condiciona su contenido a `Consultar` |
| Selects | Sin `Opciones` del módulo, el `GET /<modulo>/opciones` responde 403 y el select queda vacío |

Como el frontend guarda la lista al cargar, un cambio de permisos se ve en la interfaz al renovar la sesión (≤ 14 min), recargar o volver a entrar; el backend ya lo aplica antes.

## Endpoint → permiso

Todos bajo `/api`. "Sesión" = solo token válido (sin `@RequierePermiso`).

### Auth, Sistema y Menú

| Método | Ruta | Exige |
|---|---|---|
| GET | `/health` | Público |
| POST | `/auth/login`, `/auth/refresh`, `/auth/recuperar-password` | Público |
| POST | `/auth/cambiar-password`, `/auth/logout` | Sesión (permitido con cambio obligatorio pendiente) |
| POST | `/auth/resetear-password/:idUsuario` | `@Roles` Super Administrador o Administrador (por nombre, no por permiso) + jerarquía |
| GET | `/permisos/mis-permisos` | Sesión |
| GET | `/menu/activos` | Sesión |

### Por módulo

| Método | Ruta | Menú / Acción |
|---|---|---|
| GET | `/roles/opciones` | Roles / Opciones |
| GET | `/roles`, `/roles/:id` | Roles / Consultar |
| POST | `/roles` | Roles / Crear |
| PATCH | `/roles/:id` | Roles / Editar |
| DELETE | `/roles/:id` | Roles / Eliminar |
| GET | `/permisos`, `/permisos/:id` | Permisos / Consultar |
| POST | `/permisos` | Permisos / Crear |
| PATCH | `/permisos/:id` | Permisos / Editar |
| DELETE | `/permisos/:id` | Permisos / Eliminar |
| GET | `/usuarios/opciones` | Usuarios / Opciones |
| GET | `/usuarios`, `/usuarios/:id` | Usuarios / Consultar |
| POST | `/usuarios` | Usuarios / Crear |
| PATCH | `/usuarios/:id` | Usuarios / Editar |
| DELETE | `/usuarios/:id` | Usuarios / Eliminar |
| GET | `/menu`, `/menu/:id` | Menu / Consultar |
| POST | `/menu` | Menu / Crear |
| PATCH | `/menu/:id` | Menu / Editar |
| DELETE | `/menu/:id` | Menu / Eliminar |
| GET | `/novedades/opciones` | Novedades / Opciones |
| GET | `/novedades`, `/novedades/:id` | Novedades / Consultar |
| POST | `/novedades` | Novedades / Crear |
| PATCH | `/novedades/:id` | Novedades / Editar |
| DELETE | `/novedades/:id` | Novedades / Eliminar |
| GET | `/configuracion`, `/configuracion/:id` | Configuración / Consultar |
| POST | `/configuracion` | Configuración / Crear |
| PATCH | `/configuracion/:id` | Configuración / Editar |
| DELETE | `/configuracion/:id` | Configuración / Eliminar |
| GET | `/soporte`, `/soporte/:id` | Soporte / Consultar |
| GET | `/soporte/motores` | Soporte / **Crear** (select Motor del formulario) |
| GET | `/soporte/clientes` | Soporte / **Crear** (autocompletado del formulario) |
| POST | `/soporte` | Soporte / Crear |
| POST | `/soporte/:id/ejecutar` | Soporte / **Editar** |
| PATCH | `/soporte/:id` | Soporte / Editar |
| DELETE | `/soporte/:id` | Soporte / Eliminar |
| GET | `/informes`, `/informes/usuarios`, `/informes/resumen`, `/informes/exportar` | Informe / Consultar |
| GET | `/tablero/kpis`, `/tablero/usuarios` | `@Roles` Super Administrador o Administrador **y** Tablero / Consultar |

Además del permiso, Roles, Usuarios y Permisos aplican la jerarquía ([04-roles-y-jerarquia](04-roles-y-jerarquia.md)). Los endpoints `/configuracion` solo exigen el permiso: la exclusividad del Super Administrador se garantiza porque solo él puede asignar permisos de Configuración (y, en Menu, solo él gestiona la opción con ruta `/configuracion`).

## Reglas de la vista Permisos

| Regla | Detalle |
|---|---|
| Único | Un mismo rol + menú + acción solo existe una vez, activo o inactivo (los eliminados no cuentan). Duplicado → **409** "Ese permiso ya existe (Menú / Acción para este rol)."; si el existente está inactivo agrega ", está inactivo: edítalo para activarlo". |
| Menú válido | Debe ser igual a una opción de menú activa → si no, **400** "El valor de Menu debe ser igual al de una opción de menú activa." |
| Acción válida | Según `ACCIONES_POR_MENU` → **400** "El menú X solo admite: …" |
| Tablero | Su permiso solo se asigna a Super Administrador y Administrador (al crear y al editar, validado sobre el rol resultante). Otro rol → **403** "El Tablero solo puede asignarse a los roles Super Administrador y Administrador."; la vista Permisos solo ofrece esos dos roles cuando el menú es Tablero. |
| Jerarquía | Solo permisos de roles del nivel propio hacia abajo. Al editar se valida el permiso actual **y** el resultado (no se puede mover a un rol superior). **403** "No puedes gestionar permisos de un rol por encima del tuyo." |
| Configuración | Solo el Super Administrador ve, asigna, edita o elimina permisos del menú Configuración (**403** "Solo el Super Administrador puede gestionar permisos de Configuración."). A los demás no les aparecen en el listado ni en el select de menú. |
| Descripción | Opcional, 3–255 |
| Estado | Solo al editar (Activo/Inactivo). Un permiso inactivo no concede nada. |

Formulario: **Rol** (de `/api/roles/opciones`, requiere Roles / Opciones), **Menu** (de `/api/menu/activos`), **Acción**, Estado (al editar), Descripción. En la tabla, los permisos de roles superiores (o de Configuración para quien no es Super Administrador) no muestran Editar ni Eliminar.

## Endpoints (`/api/permisos`)

| Método | Ruta | Permiso | Cuerpo | Respuesta (`data`) |
|---|---|---|---|---|
| GET | `/mis-permisos` | Sesión | — | `[{ menu, permiso }]` activos del rol del usuario, ordenados por menú y acción |
| GET | `/?page&limit` | Permisos / Consultar | — | Permisos paginados (id descendente) con `rolRef` y `responsable` |
| GET | `/:id` | Permisos / Consultar | — | Permiso (404 si está fuera de alcance) |
| POST | `/` | Permisos / Crear | `{ idRol, menu, permiso, descripcion? }` | Permiso · "Permiso creado correctamente." |
| PATCH | `/:id` | Permisos / Editar | `{ idRol?, menu?, permiso?, descripcion?, estadoRegistro? }` | Permiso · "Permiso actualizado correctamente." |
| DELETE | `/:id` | Permisos / Eliminar | — | `null` · "Permiso eliminado correctamente." (borrado lógico) |

## Código

| Parte | Ruta |
|---|---|
| Entidad, enums, `ACCIONES_POR_MENU` | `backend/src/modules/permisos/permiso.entity.ts` |
| Controller / servicio / DTOs | `backend/src/modules/permisos/` |
| Decorador y guard | `backend/src/common/auth/requiere-permiso.decorator.ts` · `backend/src/common/auth/permisos.guard.ts` |
| Matriz del seed | `backend/src/database/seeds/run-seed.ts` |
| Servicio y guard (frontend) | `frontend/src/app/core/services/permisos.service.ts` · `frontend/src/app/core/guards/permiso.guard.ts` |
| Pantalla | `frontend/src/app/features/permisos/` |

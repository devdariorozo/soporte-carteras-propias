# 04 · Roles y jerarquía

## Roles

Tabla `roles` (campos comunes: `estado_registro`, `descripcion`, `id_usuario`, fechas de creación, actualización y eliminación). El seed crea cuatro:

| id | Rol | Para qué |
|---|---|---|
| 1 | Super Administrador | Todo el sistema, incluida Configuración |
| 2 | Administrador | Todo menos Configuración |
| 3 | Desarrollador(a) | Registrar y ejecutar soportes, catálogo de novedades, informes |
| 4 | Aprendiz Sena | Solo consultar el Informe |

Los nombres fijos están en el enum `NombreRol` (`backend/src/modules/roles/rol.entity.ts`). El backend los usa por nombre en `@Roles(...)` del restablecimiento de contraseña y en la regla de Configuración; además, al emitir los tokens usa `Desarrollador(a)` como valor por defecto del claim `rol` si el usuario no trae rol cargado. Todo lo demás depende de los permisos por fila ([05-permisos](05-permisos.md)) y de la jerarquía.

## Jerarquía

El **id del rol es su nivel**: menor id = más arriba. Los roles creados después quedan por debajo (id mayor, autoincremental).

**Un rol gestiona los roles con id igual o mayor al suyo** (su mismo nivel y los de abajo), sus permisos y sus usuarios. Nunca los de arriba.

| Quien actúa | Ve y gestiona roles | No ve ni gestiona |
|---|---|---|
| Super Administrador (1) | 1, 2, 3, 4… (todos) | — |
| Administrador (2) | 2, 3, 4… | 1 |
| Desarrollador(a) (3) | 3, 4… (si tiene el permiso del módulo) | 1, 2 |
| Aprendiz Sena (4) | 4, 5… (si tiene el permiso del módulo) | 1, 2, 3 |
| Rol creado (n) | n, n+1… (si tiene el permiso) | Los de id < n |

"Igual o mayor" incluye el propio nivel: un Administrador puede editar el rol Administrador y a otros Administradores.

### Funciones (`backend/src/common/auth/jerarquia-roles.util.ts`)

| Función | Qué hace |
|---|---|
| `puedeGestionarRol(actor, idRolObjetivo)` | `idRolObjetivo >= actor.idRol` |
| `rolesVisibles(actor)` | Filtro `where` `MoreThanOrEqual(actor.idRol)` para listados y selects |
| `exigirJerarquia(actor, idRol, titulo, mensaje)` | Lanza **403** si el rol objetivo está por encima; si `idRol` es `null`/`undefined` no valida |
| `exigirSuperAdministrador(actor, condicion, titulo, mensaje)` | Lanza **403** si se cumple la condición y el actor no es Super Administrador (usado para Configuración) |

El `actor` sale del access token (`idRol`, `rol`): un cambio de rol se refleja al renovar el token (máximo el tiempo de vida del access token).

### Dónde aplica

| Módulo | Operaciones con jerarquía | Cómo responde lo de arriba |
|---|---|---|
| Roles | Listar, ver, editar, eliminar, `/roles/opciones` | Listado y opciones: no aparece. Ver por id: **404** "Rol no encontrado.". Editar/eliminar: **403** "No puedes gestionar un rol por encima del tuyo." |
| Usuarios | Listar, ver, crear, editar, eliminar, rol asignable, `/usuarios/opciones` | Listado: no aparece. Ver: **404**. Crear/editar/eliminar o asignar un rol superior: **403** "No puedes gestionar usuarios de un rol por encima del tuyo." |
| Restablecer contraseña | `POST /api/auth/resetear-password/:id` | **403** "No puedes restablecer la contraseña de un usuario con un rol por encima del tuyo." |
| Permisos | Listar, ver, crear, editar, eliminar | Listado: no aparece. Ver: **404**. Resto: **403** "No puedes gestionar permisos de un rol por encima del tuyo." |

En el frontend (`frontend/src/app/core/utils/jerarquia-roles.util.ts`) la misma regla solo **oculta** los botones Editar, Eliminar y Restablecer contraseña en filas de roles superiores (`reservado(...)` en cada pantalla). Quien lo hace cumplir es el backend. Si la sesión guardada no trae `idRol` (sesión anterior a ese campo), el frontend trata al Super Administrador como nivel 1 y a cualquier otro como sin alcance hasta que vuelva a entrar.

## Excepción fija: Configuración

**Configuración** es exclusiva del Super Administrador, sin importar la jerarquía ni los permisos: solo él ve, asigna o modifica permisos del menú Configuración (ver [05-permisos](05-permisos.md) y [09-configuracion](09-configuracion.md)).

## Reglas de roles

| Campo | Regla |
|---|---|
| Rol (nombre) | Obligatorio, máx. 45. Se normaliza: espacios de sobra fuera y **primera letra de cada palabra en mayúscula** (el frontend lo hace al escribir, el backend al guardar). Único entre roles no eliminados → **409** "El rol ya existe." |
| Descripción | Opcional, 3–255. Vacío = no se envía. Primera letra en mayúscula al escribir. |
| Estado | Solo al editar: Activo (1) / Inactivo (0). Al crear siempre queda Activo. |

- **Crear:** requiere permiso `Roles / Crear`. No aplica jerarquía (el rol nuevo siempre queda por debajo de todos, id mayor). Responsable (`id_usuario`) = quien lo crea.
- **Editar:** `Roles / Editar` + jerarquía. Solo cambia los campos enviados (PATCH).
- **Eliminar:** `Roles / Eliminar` + jerarquía. Borrado lógico: `estado_registro = 0` y `fecha_eliminacion`. No revisa si tiene usuarios o permisos asociados: esos usuarios siguen pudiendo entrar y sus permisos siguen activos. Reasigna los usuarios antes de eliminar un rol.
- **Inactivo:** deja de salir en `/roles/opciones` (selects de Usuarios y Permisos), pero sigue en el listado. No bloquea el login de sus usuarios ni desactiva sus permisos.
- Listado ordenado por id descendente, paginado (10 por defecto), con columna **Responsable** (nombre completo de quien hizo el último cambio).

## Endpoints (`/api/roles`)

| Método | Ruta | Permiso | Cuerpo | Respuesta (`data`) |
|---|---|---|---|---|
| GET | `/opciones` | Roles / Opciones | — | `[{ id, rol }]` activos, del nivel propio hacia abajo, por id ascendente |
| GET | `/?page&limit` | Roles / Consultar | — | Roles paginados + `responsable` + `pagination` |
| GET | `/:id` | Roles / Consultar | — | Rol |
| POST | `/` | Roles / Crear | `{ rol, descripcion? }` | Rol creado · "Rol creado correctamente." |
| PATCH | `/:id` | Roles / Editar | `{ rol?, descripcion?, estadoRegistro? }` | Rol · "Rol actualizado correctamente." |
| DELETE | `/:id` | Roles / Eliminar | — | `null` · "Rol eliminado correctamente." |

`/roles/opciones` alimenta el select **Rol** de Usuarios y de Permisos: sin ese permiso el select queda vacío.

## Código

| Parte | Ruta |
|---|---|
| Entidad y enum `NombreRol` | `backend/src/modules/roles/rol.entity.ts` |
| Controller / servicio / DTOs | `backend/src/modules/roles/` |
| Jerarquía (backend) | `backend/src/common/auth/jerarquia-roles.util.ts` |
| Jerarquía (frontend, solo UI) | `frontend/src/app/core/utils/jerarquia-roles.util.ts` |
| Pantalla | `frontend/src/app/features/roles/` |

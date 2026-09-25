# 06 · Usuarios

Personas que entran al sistema. Cada usuario tiene un rol, que define sus permisos ([05-permisos](05-permisos.md)) y su alcance ([04-roles-y-jerarquia](04-roles-y-jerarquia.md)).

## Campos y validaciones

Tabla `usuarios`. Las reglas valen en frontend (formulario) y backend (`CrearUsuarioDto` / `ActualizarUsuarioDto`) salvo que se indique.

| Campo | Obligatorio | Regla | Formato |
|---|---|---|---|
| Número de documento (`numero_documento`) | Sí | 7–21 caracteres **contando los puntos** | El frontend solo deja dígitos y agrega puntos de miles al escribir (`1.234.567.890`); el backend no revisa el formato |
| Usuario (`usuario`) | Sí | **Único**. Es el identificador de login | Se completa solo con el documento sin puntos al crear (editable). Al editar el documento no se actualiza solo |
| Primer nombre | Sí | 3–45 | Primera letra en mayúscula |
| Segundo nombre | No | 2–45 si se llena | Primera letra en mayúscula; vacío = `NULL` |
| Primer apellido | Sí | 3–45 | Primera letra en mayúscula |
| Segundo apellido | No | 2–45 si se llena | Primera letra en mayúscula; vacío = `NULL` |
| Número de contacto | Sí | Exactamente 10 dígitos | Se formatea y guarda como `321 256 5689` (3-3-4). El backend acepta también `3212565689` o `321-256-5689` y lo normaliza |
| Rol (`id_rol`) | Sí | Solo roles del nivel propio hacia abajo | Select con `/api/roles/opciones` (roles activos) |
| Correo | Sí | Correo válido, **único** | — |
| Contraseña temporal | Sí, solo al crear | Política de contraseña segura ([03](03-autenticacion-y-sesion.md#contraseña-segura)) con medidor | Se guarda con bcrypt |
| Estado | Solo al editar | Activo (1) / Inactivo (0) | Al crear siempre Activo |
| Descripción | No | 3–255 | Primera letra en mayúscula |

### Capitalización de nombres

- Solo la **primera letra** del texto va en mayúscula; el resto queda como se escribió (`de la Cruz` → `De la Cruz`, `mARÍA` → `MARÍA`).
- El frontend lo aplica al escribir (`core/utils/texto.util.ts`, `capitalizarPrimeraLetra`); el backend lo vuelve a aplicar al guardar y además quita espacios al inicio y al final (`common/utils/texto.util.ts`).

### Unicidad

| Campo | Único | Mensaje |
|---|---|---|
| Usuario | Sí (índice `uq_usuarios_usuario`) | **409** "Ya existe un usuario con ese número de documento o correo." |
| Correo | Sí (índice `uq_usuarios_correo`) | Mismo mensaje |
| Número de documento | **No** en la base (el mensaje lo menciona, pero no hay índice). En la práctica lo protege `usuario`, que por defecto es el documento sin puntos |

Los usuarios eliminados (borrado lógico) no cuentan: su correo y su usuario quedan libres para un usuario nuevo. Uno inactivo sí cuenta. Ver [02-base-de-datos](02-base-de-datos.md#tablas).

### Datos que nunca se devuelven

`password`, `secreto` y `refresh_token` se quitan de toda respuesta (`sanitizar`). Sí se devuelven los datos del último login (`ultimoTipoEquipo`, `ultimoNavegador`, `ultimoSistemaOperativo`, `ultimaFechaLogin`), aunque la tabla no los muestra.

## Alta

1. **Nuevo** (requiere `Usuarios / Crear`).
2. Se diligencia el formulario; el rol solo ofrece los del nivel propio hacia abajo.
3. El backend valida la jerarquía del rol asignado, capitaliza nombres, guarda la contraseña temporal con bcrypt, `secreto = NULL`, `debe_cambiar_password = 1`, estado Activo y responsable = quien crea.
4. Mensaje "Usuario creado correctamente.".
5. En su primer ingreso el usuario debe cambiar la contraseña y definir el secreto ([03](03-autenticacion-y-sesion.md#primer-ingreso-y-cambio-de-contraseña)).

## Edición

- Lápiz (requiere `Usuarios / Editar`); oculto en usuarios de roles superiores.
- PATCH: solo cambia los campos enviados. La contraseña y el secreto **no** se editan aquí (se usan los endpoints de `/api/auth`).
- Jerarquía: se valida el rol actual del usuario **y** el rol nuevo si se cambia.
- Mensaje "Usuario actualizado correctamente.".
- Un cambio de rol se refleja en la sesión del usuario afectado cuando su token se renueva.
- Limitación actual: vaciar **Segundo nombre**, **Segundo apellido** o **Descripción** al editar no los borra; el frontend envía vacío, el backend lo toma como "no enviado" y conserva el valor anterior.

## Activar / inactivar

Campo **Estado** del formulario de edición.

| Estado | Efecto |
|---|---|
| Inactivo (0) | No puede iniciar sesión ("Usuario o contraseña incorrectos."), no puede recuperar contraseña, la renovación de sesión falla ("Usuario no encontrado o inactivo.") y no sale en `/usuarios/opciones`. Sigue en el listado. |
| Activo (1) | Vuelve a entrar con su contraseña actual |

Inactivar **no cierra la sesión en curso** de inmediato: el access token vigente sirve hasta que vence (15 min por defecto) y el siguiente refresh lo saca.

## Eliminar

Papelera (requiere `Usuarios / Eliminar`) con confirmación. Borrado lógico: `estado_registro = 0`, `descripcion = 'Eliminado.'`, `fecha_eliminacion`. Deja de aparecer en el listado y no puede entrar. Mensaje "Usuario eliminado correctamente.".

## Restablecer contraseña

Botón de llave en la fila del usuario.

| Regla | Detalle |
|---|---|
| Quién | Solo roles **Super Administrador** y **Administrador** (por nombre, `@Roles`; no depende de permisos). El botón solo se muestra a esos roles |
| A quién | Usuarios de roles del nivel propio hacia abajo (jerarquía) |
| Contraseña temporal | Política de contraseña segura, con medidor |
| Efecto | Nueva contraseña (bcrypt), `secreto = NULL`, `debe_cambiar_password = 1`, `refresh_token = NULL`, `descripcion = 'Contraseña reseteada por un administrador.'`, responsable = quien restablece, y borra la sesión de Redis: el usuario sale **de inmediato** en todos lados |
| Al volver a entrar | Debe definir contraseña y secreto nuevos (modal obligatorio) |

Mensaje: "Contraseña temporal asignada. El usuario deberá definir contraseña y secreto nuevos al ingresar." (la pantalla muestra "Contraseña temporal asignada correctamente.").

## Alcance por jerarquía

| Operación | Regla |
|---|---|
| Listar | Solo usuarios con rol de id ≥ al propio (los de arriba ni se listan) |
| Ver por id | Fuera de alcance → **404** "Usuario no encontrado." |
| Crear / editar / eliminar / asignar rol | Fuera de alcance → **403** "No puedes gestionar usuarios de un rol por encima del tuyo." |
| Restablecer contraseña | **403** "No puedes restablecer la contraseña de un usuario con un rol por encima del tuyo." |
| `/usuarios/opciones` | Solo usuarios activos de roles del nivel propio hacia abajo |

"Nivel propio" incluye el mismo rol: un Administrador gestiona a otros Administradores (y a sí mismo).

## Listado

Paginado (10 por defecto), id descendente. Columnas: Número, Número de documento, Primer/Segundo nombre, Primer/Segundo apellido, Número de contacto, Rol, Correo, Usuario, Estado, Descripción, Responsable (nombre completo de quien hizo el último cambio), Fecha, Actualizado y acciones.

El nombre del rol de la columna **Rol** sale de `/api/roles/opciones` (roles activos del alcance): si el rol está inactivo o falta el permiso `Roles / Opciones`, se ve `#<id>`.

## `GET /api/usuarios/opciones`

- Permiso: `Usuarios / Opciones` (el seed se lo da a Super Administrador, Administrador y Desarrollador(a); Aprendiz Sena no lo tiene).
- Devuelve usuarios **activos** de roles del nivel propio hacia abajo, ordenados por primer nombre:

```json
{ "data": [ { "id": 7, "nombreCompleto": "Ana María Pérez" } ] }
```

- `nombreCompleto` une primer nombre, segundo nombre, primer apellido y segundo apellido, **omitiendo los vacíos** (`nombreCompleto` en `common/utils/responsable.util.ts`, la misma función de la columna Responsable).
- Hoy ninguna pantalla lo consume. El filtro **Usuario** de Informes usa otro endpoint, `GET /api/informes/usuarios` (permiso `Informe / Consultar`), que devuelve el mismo formato `{ id, nombreCompleto }` pero solo con los responsables que tienen registros en Soporte, incluidos inactivos o eliminados, en orden alfabético ([11-informes](11-informes.md)).

## Endpoints

| Método | Ruta | Permiso | Cuerpo | Respuesta (`data`) |
|---|---|---|---|---|
| GET | `/api/usuarios/opciones` | Usuarios / Opciones | — | `[{ id, nombreCompleto }]` |
| GET | `/api/usuarios?page&limit` | Usuarios / Consultar | — | Usuarios paginados con `rolRef` y `responsable` |
| GET | `/api/usuarios/:id` | Usuarios / Consultar | — | Usuario |
| POST | `/api/usuarios` | Usuarios / Crear | `{ numeroDocumento, usuario, primerNombre, segundoNombre?, primerApellido, segundoApellido?, numeroContacto, idRol, correo, passwordTemporal, descripcion? }` | Usuario creado |
| PATCH | `/api/usuarios/:id` | Usuarios / Editar | Los mismos campos opcionales (sin `passwordTemporal`) + `estadoRegistro?` | Usuario actualizado |
| DELETE | `/api/usuarios/:id` | Usuarios / Eliminar | — | `null` |
| POST | `/api/auth/resetear-password/:idUsuario` | Rol Super Administrador o Administrador | `{ passwordTemporal }` | `null` |

Ejemplo de alta (valores ficticios):

```json
{
  "numeroDocumento": "1.234.567.890",
  "usuario": "1234567890",
  "primerNombre": "Ana",
  "primerApellido": "Pérez",
  "numeroContacto": "321 256 5689",
  "idRol": 3,
  "correo": "usuario@example.com",
  "passwordTemporal": "TU_PASSWORD_TEMPORAL_AQUI"
}
```

## Código

| Parte | Ruta |
|---|---|
| Entidad | `backend/src/modules/usuarios/usuario.entity.ts` |
| Controller / servicio / DTOs | `backend/src/modules/usuarios/` |
| Nombre completo | `backend/src/common/utils/responsable.util.ts` |
| Teléfono | `backend/src/common/utils/telefono.util.ts` |
| Restablecer contraseña | `backend/src/modules/auth/auth.service.ts` (`resetearPasswordAsistido`) |
| Pantalla | `frontend/src/app/features/usuarios/` |

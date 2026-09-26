# 14 · API

API REST de NestJS. Prefijo global `/api` (`backend/src/main.ts`). Swagger interactivo: `http://localhost:6002/api/docs` en desarrollo y `http://<servidor>:7002/api/docs` en QA/PRO (también por nginx en `:6001/api/docs` / `:7001/api/docs`).

## Convenciones generales

### Autenticación

- Header `Authorization: Bearer <accessToken>` en todo endpoint salvo los marcados **Público** (`@Public()`).
- Guards globales, en orden (`app.module.ts`):

| Guard | Archivo | Rechaza con |
|---|---|---|
| `JwtAuthGuard` | `common/auth/jwt-auth.guard.ts` | 401 sin token, token inválido/vencido, o `sid` distinto al activo en Redis (sesión cerrada o reemplazada). 403 si el token trae `debeCambiarPassword` y la ruta no tiene `@AllowDuringForcedPasswordChange()` |
| `RolesGuard` | `common/auth/roles.guard.ts` | 403 si la ruta tiene `@Roles(...)` y el rol del token no está |
| `PermisosGuard` | `common/auth/permisos.guard.ts` | 403 si la ruta tiene `@RequierePermiso(menu, accion)` y no existe la fila activa rol + menú + acción en `permisos` |

- Payload del access token: `sub` (id usuario), `usuario`, `rol`, `idRol`, `sid`, `debeCambiarPassword`.
- Además de los guards, los servicios aplican la **jerarquía de roles** (403 o 404; ver [04-roles-y-jerarquia](04-roles-y-jerarquia.md)).

En las tablas de endpoints, la columna **Permiso** indica:

| Valor | Significa |
|---|---|
| Público | Sin token |
| Autenticado | Cualquier token válido, sin permiso específico |
| `Módulo / Acción` | `@RequierePermiso(Módulo, Acción)` |
| Rol: … | `@Roles(...)` por nombre de rol |

### Envelope de respuesta

Toda respuesta JSON sale envuelta (`common/interceptors/response.interceptor.ts`, `common/envelope/envelope.util.ts`):

```json
{
  "status": "success",
  "title": "Roles",
  "message": "Rol creado correctamente.",
  "data": { "id": 5, "rol": "Supervisor" },
  "pagination": { "total": 25, "page": 1, "limit": 10, "total_pages": 3 }
}
```

| Campo | Regla |
|---|---|
| `status` | `success` o `error` |
| `title` | `@ResponseTitle('…')` del controller (nombre del módulo); sin decorador: `Sistema` |
| `message` | El que devuelve el servicio; por defecto `Operación exitosa.` |
| `data` | Objeto, lista o `null` |
| `pagination` | Solo en listados paginados |

- El servicio devuelve `{ message?, data?, pagination? }` y el interceptor arma el envelope; si devuelve otra cosa, va completa a `data`.
- `@SkipEnvelope()` (`common/decorators/skip-envelope.decorator.ts`) desactiva el envelope; solo lo usa `GET /api/informes/exportar` (binario).

### Envelope de error

`common/filters/http-exception.filter.ts` captura todo:

```json
{ "status": "error", "title": "Usuarios", "message": "Usuario no encontrado.", "data": null, "pagination": null }
```

- `title`: el que trae la excepción (`new XxxException({ title, message })`); si no, `Sistema`.
- `message`: texto de la excepción; si es una lista (errores de validación del DTO), se unen con espacio.
- Error no controlado: 500, `Ocurrió un error inesperado.` (el detalle solo va al log).

### Validación del cuerpo y la query

`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`:

- Un campo que no está en el DTO → **400** (`property X should not exist`).
- `transform`: la query se convierte a número/arreglo según el DTO.
- Los `@Param('id', ParseIntPipe)` no numéricos → 400.
- Los mensajes sin texto propio salen en inglés (por defecto de `class-validator`).

### Paginación

Query común (`common/dto/paginacion-query.dto.ts`):

| Parámetro | Tipo | Defecto | Regla |
|---|---|---|---|
| `page` | entero | 1 | ≥ 1 |
| `limit` | entero | 10 | ≥ 1 (sin máximo) |

Respuesta: `data` con la página y `pagination: { total, page, limit, total_pages }` (`total_pages` mínimo 1). Orden: `id` descendente. Los registros eliminados (borrado lógico) no aparecen, salvo en Informes.

### Códigos de error habituales

| Código | Cuándo |
|---|---|
| 400 | DTO inválido, campo no permitido, contraseña actual incorrecta, menú inexistente o acción no admitida en Permisos, conexión de Configuración incompleta |
| 401 | Sin token, token vencido/inválido, sesión reemplazada, credenciales o secreto incorrectos, refresh inválido |
| 403 | Sin permiso (`No tienes permiso para realizar esta acción.`), cambio de contraseña pendiente, jerarquía (rol por encima del propio), Configuración reservada al Super Administrador |
| 404 | Registro inexistente, o fuera del alcance jerárquico (no se revela que existe) |
| 409 | Duplicado: rol, novedad, usuario (`usuario` o `correo`), permiso rol + menú + acción, menú (nombre, ruta u orden). Solo cuentan los registros no eliminados ([02](02-base-de-datos.md#tablas)) |
| 422 | Soporte: la sentencia no es un UPDATE/INSERT permitido, mezcla UPDATE e INSERT o parece del otro motor ([10-soporte](10-soporte.md)) |
| 429 | Límite excedido: intentos fallidos de login / recuperar contraseña, o ejecuciones por minuto de Soporte ([abajo](#429-límite-excedido)) |
| 500 | Error no controlado (incluye la espera de más de 30 s en `/soporte/:id/ejecutar`) |

### 429 (límite excedido)

Mismo envelope de error que el resto (`status: "error"`, `title`, `message`, `data: null`); no se envía cabecera `Retry-After`: el tiempo de espera va en el mensaje.

| Origen | Endpoints | Configuración | Alcance | Mensaje |
|---|---|---|---|---|
| Intentos fallidos | `POST /auth/login`, `POST /auth/recuperar-password` | `LOGIN_MAX_INTENTOS` / `LOGIN_VENTANA_MINUTOS` en `backend/.env` (por defecto 5 / 15 min) | Por usuario y endpoint | `Demasiados intentos fallidos. Intenta de nuevo en N minutos.` (título `Login`) |
| Ejecuciones de Soporte | `POST /soporte/:id/ejecutar` | Fila activa `rate_limit` de Configuración (`requests_por_minuto`); sin ella, sin límite | Global, por minuto de reloj | `Se alcanzó el límite de ejecuciones por minuto, intenta de nuevo en unos segundos.` (título `Soporte`) |

Frontend: `esLimiteExcedido(error)` (`frontend/src/app/core/utils/limite-excedido.util.ts`) reconoce el 429 y Login, Recuperar contraseña y Soporte lo muestran como **aviso amarillo** ("Atención") con el mensaje del backend, no como error rojo. No se reintenta solo. Detalle: [03](03-autenticacion-y-sesion.md#límite-de-intentos-login-y-recuperar-contraseña) y [09](09-configuracion.md#rate-limit).

### CORS

`common/cors/opciones-cors.util.ts`, variable `CORS_ORIGENES` de `backend/.env`:

| Valor | Efecto |
|---|---|
| `*` | Cualquier origen |
| `https://origen-1,https://origen-2` | Solo esos (se quita la `/` final) |
| Vacío o sin definir | Ningún origen cruzado |

Métodos fijos: `GET, POST, PATCH, DELETE, OPTIONS`. Headers permitidos: `Content-Type, Authorization`. La app servida por nginx y `ng serve` con proxy usan el mismo origen y no dependen de esto ([13-despliegue-y-operacion](13-despliegue-y-operacion.md#cors)).

### Campos comunes de los registros

Toda entidad hereda `AuditableBaseEntity` (`common/entities/auditable.base-entity.ts`): `id`, `estadoRegistro` (1 activo / 0 inactivo), `descripcion`, `idUsuario` (último usuario que modificó), `fechaCreacion`, `fechaActualizacion`, `fechaEliminacion`. Los listados paginados agregan `responsable` (nombre completo de `idUsuario`), salvo `GET /api/soporte`.

Reglas comunes de los DTO de actualización (`PATCH`):

- Todos los campos opcionales; solo se aplican los enviados (`asignarDefinidos`).
- `descripcion`: 3–255; `''` se trata como no enviado (no existe en Soporte: la escribe el sistema).
- `estadoRegistro`: `0` o `1`.
- `DELETE` = borrado lógico: `estadoRegistro = 0` + `fechaEliminacion`.

---

## Sistema

`backend/src/health/health.controller.ts` · título `Sistema`

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | `/api/health` | Público | `data: { status: 'ok', timestamp }`, mensaje `Servicio disponible.` |

## Login (`/api/auth`)

`backend/src/modules/auth/auth.controller.ts` · título `Login` · detalle en [03-autenticacion-y-sesion](03-autenticacion-y-sesion.md)

| Método | Ruta | Permiso | Cuerpo | Respuesta |
|---|---|---|---|---|
| POST | `/login` | Público | `LoginDto` | `data: { accessToken, refreshToken, expiresIn, usuario }` |
| POST | `/refresh` | Público | `RefreshTokenDto` | Igual que login (tokens nuevos; el anterior deja de servir) |
| POST | `/recuperar-password` | Público | `RecuperarPasswordDto` | `data: null` |
| POST | `/cambiar-password` | Autenticado (permitido con cambio pendiente) | `CambiarPasswordDto` | `data: null` |
| POST | `/resetear-password/:idUsuario` | Rol: Super Administrador, Administrador (+ jerarquía) | `ResetearPasswordAsistidoDto` | `data: null` |
| POST | `/logout` | Autenticado (permitido con cambio pendiente) | — | `data: null` |

DTO (`modules/auth/dto/`):

| DTO | Campo | Validación |
|---|---|---|
| `LoginDto` | `usuario` | texto, obligatorio (documento sin puntos) |
| | `password` | texto, obligatorio |
| `RefreshTokenDto` | `refreshToken` | texto, obligatorio |
| `RecuperarPasswordDto` | `usuario` | texto, obligatorio |
| | `secreto` | texto, 3–45 |
| | `passwordNueva` | contraseña segura |
| `CambiarPasswordDto` | `passwordActual` | texto, obligatorio |
| | `passwordNueva` | contraseña segura |
| | `secretoNuevo` | texto, 3–45, obligatorio |
| `ResetearPasswordAsistidoDto` | `passwordTemporal` | contraseña segura |

Contraseña segura = `PASSWORD_SEGURA_REGEX` (`common/validators/password-segura.ts`): ≥ 8, mayúscula, minúscula, número y carácter especial.

`usuario` en la respuesta de login/refresh: `{ id, usuario, primerNombre, primerApellido, rol, idRol, debeCambiarPassword }`. `expiresIn` en segundos. El header `User-Agent` se usa para registrar equipo, navegador y sistema operativo del último ingreso.

Errores propios:

| Endpoint | Código | Mensaje |
|---|---|---|
| `/login` | 401 | `Usuario o contraseña incorrectos.` (también si el usuario está inactivo) |
| `/login`, `/recuperar-password` | 429 | `Demasiados intentos fallidos. Intenta de nuevo en N minutos.` ([429](#429-límite-excedido)) |
| `/refresh` | 401 | Refresh inválido o vencido, sesión reemplazada, usuario inactivo, o sesión que ya no coincide con la BD |
| `/recuperar-password` | 401 | `Usuario o secreto incorrectos.` |
| `/cambiar-password` | 400 | `La contraseña actual no es correcta.` (400 y no 401 para no cerrar la sesión) |
| `/resetear-password/:idUsuario` | 404 / 403 | Usuario inexistente / rol por encima del propio |

Efectos: `resetear-password` asigna la temporal, borra el secreto, marca `debeCambiarPassword` y cierra la sesión del usuario. `logout` borra la sesión en Redis y en BD.

## Configuración (`/api/configuracion`)

`modules/configuracion/configuracion.controller.ts` · título `Configuración` · detalle en [09-configuracion](09-configuracion.md)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | `/` | `Configuración / Consultar` | paginación | Lista paginada |
| GET | `/:id` | `Configuración / Consultar` | — | Registro |
| POST | `/` | `Configuración / Crear` | `CrearConfiguracionDto` | Registro creado; desactiva la fila activa anterior con el mismo `nombre` |
| PATCH | `/:id` | `Configuración / Editar` | `ActualizarConfiguracionDto` | Registro actualizado |
| DELETE | `/:id` | `Configuración / Eliminar` | — | `data: null` |

| Campo | Crear | Actualizar |
|---|---|---|
| `nombre` | texto, obligatorio, máx. 45 | opcional, máx. 45 |
| `alcance` | texto, obligatorio, 3–45 | opcional, 3–45 |
| `objeto` | objeto plano obligatorio: claves no vacías; valores texto, número, booleano o lista de textos/números | opcional; **reemplaza** el objeto completo |
| `descripcion` | opcional | opcional |
| `estadoRegistro` | — | opcional |

- El objeto se normaliza por `nombre` (`normalizar-objeto.util.ts`: `port` → número, `ssl` → booleano, etc.; `password` y `ssh_passphrase` se guardan tal cual).
- Para `mysql` y `postgres` se exigen los datos de conexión (`conexion-bd.util.ts`); si faltan → 400.
- La respuesta incluye el `objeto` completo (con contraseñas).

## Roles (`/api/roles`)

`modules/roles/roles.controller.ts` · título `Roles`

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | `/opciones` | `Roles / Opciones` | — | `[{ id, rol }]` activos, del nivel propio hacia abajo, por id |
| GET | `/` | `Roles / Consultar` | paginación | Lista paginada, solo roles del nivel propio hacia abajo |
| GET | `/:id` | `Roles / Consultar` | — | Registro; 404 si está por encima |
| POST | `/` | `Roles / Crear` | `CrearRolDto` | Registro creado |
| PATCH | `/:id` | `Roles / Editar` | `ActualizarRolDto` | Registro actualizado; 403 si está por encima |
| DELETE | `/:id` | `Roles / Eliminar` | — | `data: null`; 403 si está por encima |

| Campo | Crear | Actualizar |
|---|---|---|
| `rol` | texto, obligatorio, máx. 45 | opcional, máx. 45 |
| `descripcion` | opcional | opcional |
| `estadoRegistro` | — | opcional |

`rol` se guarda con mayúscula inicial por palabra; repetido → 409.

## Menú (`/api/menu`)

`modules/menu/menu.controller.ts` · título `Menú` · detalle en [07-menu](07-menu.md)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | `/activos` | Autenticado | — | Todas las opciones activas por `orden` ascendente (arma la barra lateral) |
| GET | `/` | `Menu / Consultar` | paginación | Lista paginada |
| GET | `/:id` | `Menu / Consultar` | — | Registro |
| POST | `/` | `Menu / Crear` | `CrearMenuDto` | Registro creado |
| PATCH | `/:id` | `Menu / Editar` | `ActualizarMenuDto` | Registro actualizado |
| DELETE | `/:id` | `Menu / Eliminar` | — | `data: null` |

| Campo | Crear | Actualizar |
|---|---|---|
| `apartado` | texto, obligatorio, 3–45 | opcional, 3–45 |
| `menu` | texto, obligatorio, 3–45 | opcional, 3–45 |
| `ruta` | obligatoria, máx. 150, patrón `^/[a-z0-9]+(-[a-z0-9]+)*(/…)*$` (ej. `/soporte`) | opcional, mismo patrón |
| `icono` | texto, obligatorio, 3–45 (clase PrimeIcons, ej. `pi pi-shield`) | opcional, 3–45 |
| `orden` | entero, obligatorio | opcional |
| `descripcion` | opcional | opcional |
| `estadoRegistro` | — | opcional |

- `apartado` y `menu` se guardan con mayúscula inicial por palabra.
- `menu`, `ruta` y `orden` únicos → 409 si se repiten entre las opciones no eliminadas; una opción eliminada no cuenta.
- La opción con ruta `/configuracion` (y asignar esa ruta) solo la edita o elimina el Super Administrador → 403.

## Permisos (`/api/permisos`)

`modules/permisos/permisos.controller.ts` · título `Permisos` · detalle en [05-permisos](05-permisos.md)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | `/mis-permisos` | Autenticado | — | `[{ menu, permiso }]` activos del rol del token, ordenados |
| GET | `/` | `Permisos / Consultar` | paginación | Lista paginada (con `rolRef`); solo roles del nivel propio hacia abajo; sin los de Configuración salvo Super Administrador |
| GET | `/:id` | `Permisos / Consultar` | — | Registro; 404 si está fuera de alcance |
| POST | `/` | `Permisos / Crear` | `CrearPermisoDto` | Registro creado |
| PATCH | `/:id` | `Permisos / Editar` | `ActualizarPermisoDto` | Registro actualizado |
| DELETE | `/:id` | `Permisos / Eliminar` | — | `data: null` |

| Campo | Crear | Actualizar |
|---|---|---|
| `idRol` | entero, obligatorio | opcional |
| `menu` | texto, obligatorio, máx. 45; igual a una opción de menú **activa** | opcional, misma regla |
| `permiso` | `Crear` \| `Editar` \| `Eliminar` \| `Consultar` \| `Opciones` | opcional |
| `descripcion` | opcional | opcional |
| `estadoRegistro` | — | opcional |

Errores propios: menú inexistente o acción no admitida por el menú (`Informe` solo `Consultar`; `Opciones` solo en Roles, Usuarios, Novedades) → 400; duplicado rol + menú + acción (aunque esté inactivo) → 409; rol por encima o permiso de Configuración sin ser Super Administrador → 403.

## Usuarios (`/api/usuarios`)

`modules/usuarios/usuarios.controller.ts` · título `Usuarios` · detalle en [06-usuarios](06-usuarios.md)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | `/opciones` | `Usuarios / Opciones` | — | `[{ id, nombreCompleto }]` activos, de roles del nivel propio hacia abajo |
| GET | `/` | `Usuarios / Consultar` | paginación | Lista paginada (con `rolRef`), solo roles del nivel propio hacia abajo |
| GET | `/:id` | `Usuarios / Consultar` | — | Registro; 404 si está por encima |
| POST | `/` | `Usuarios / Crear` | `CrearUsuarioDto` | Registro creado (debe cambiar la contraseña al ingresar) |
| PATCH | `/:id` | `Usuarios / Editar` | `ActualizarUsuarioDto` | Registro actualizado (no cambia contraseña ni secreto) |
| DELETE | `/:id` | `Usuarios / Eliminar` | — | `data: null` |

| Campo | Crear | Actualizar |
|---|---|---|
| `numeroDocumento` | texto, obligatorio, 7–21 (con puntos de miles, ej. `1.234.567`) | opcional, 7–21 |
| `usuario` | texto, obligatorio (documento sin puntos; login) | opcional |
| `primerNombre` / `primerApellido` | texto, 3–45 | opcional, 3–45 |
| `segundoNombre` / `segundoApellido` | opcional, 2–45 (`''` = no enviado) | opcional, 2–45 |
| `numeroContacto` | 10 dígitos; se normaliza a `XXX XXX XXXX` | opcional, misma regla |
| `idRol` | entero, obligatorio | opcional |
| `correo` | email | opcional, email |
| `passwordTemporal` | contraseña segura | — |
| `descripcion` | opcional | opcional |
| `estadoRegistro` | — | opcional |

- Nunca se devuelven `password`, `secreto` ni `refreshToken`.
- Nombres y apellidos se guardan con la primera letra en mayúscula.
- `usuario` y `correo` únicos entre usuarios no eliminados (restricción en BD) → 409 `Ya existe un usuario con ese número de documento o correo.`
- Crear, editar o eliminar un usuario de un rol por encima, o asignarle un rol por encima → 403.

## Novedades (`/api/novedades`)

`modules/novedades/novedades.controller.ts` · título `Novedades` · detalle en [08-novedades](08-novedades.md)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | `/opciones` | `Novedades / Opciones` | — | `[{ id, novedad }]` activas, por nombre |
| GET | `/` | `Novedades / Consultar` | paginación | Lista paginada |
| GET | `/:id` | `Novedades / Consultar` | — | Registro |
| POST | `/` | `Novedades / Crear` | `CrearNovedadDto` | Registro creado |
| PATCH | `/:id` | `Novedades / Editar` | `ActualizarNovedadDto` | Registro actualizado |
| DELETE | `/:id` | `Novedades / Eliminar` | — | `data: null` |

| Campo | Crear | Actualizar |
|---|---|---|
| `novedad` | texto, obligatorio, 3–45 | opcional, 3–45 |
| `descripcion` | opcional | opcional |
| `estadoRegistro` | — | opcional |

`novedad` se guarda con mayúscula inicial por palabra; repetida → 409.

## Informes (`/api/informes`)

`modules/informes/informes.controller.ts` · título `Informes` · detalle en [11-informes](11-informes.md)

| Método | Ruta | Permiso | Query | Respuesta |
|---|---|---|---|---|
| GET | `/` | `Informe / Consultar` | filtros + paginación | Registros de soporte paginados, con `novedadRef` y `responsable` |
| GET | `/usuarios` | `Informe / Consultar` | — | `[{ id, nombreCompleto }]` de quienes figuran como responsables en soporte, por nombre |
| GET | `/resumen` | `Informe / Consultar` | filtros (ignora `estadoSoporte`) | `{ "Creado": n, "En proceso": n, "Completado": n, "Error": n }` |
| GET | `/exportar` | `Informe / Consultar` | filtros (sin paginar) | **Binario** `.xlsx` sin envelope (`Content-Disposition: attachment; filename=informes-soporte-AAAA-MM-DD.xlsx`) |

Filtros (`FiltrosInformesDto`, extiende la paginación):

| Parámetro | Tipo | Regla |
|---|---|---|
| `fechaInicio` | `AAAA-MM-DD` | Inclusive. Sin fechas: día actual en hora de Colombia (UTC-5). Con una sola, se usa para ambos extremos |
| `fechaFin` | `AAAA-MM-DD` | Inclusive |
| `idNovedad` | entero, repetible (`?idNovedad=1&idNovedad=2`) | `IN` |
| `idUsuario` | entero, repetible | `IN` sobre el responsable del registro |
| `estadoSoporte` | `Creado` \| `En proceso` \| `Completado` \| `Error`, repetible | `IN` |

El informe incluye los registros de soporte eliminados (borrado lógico). En el Excel las celdas vacías salen `---`.

## Tablero (`/api/tablero`)

`modules/tablero/tablero.controller.ts` · título `Tablero` · detalle en [15-tablero](15-tablero.md)

Todo el controlador exige `@Roles` Super Administrador o Administrador **y** el permiso `Tablero / Consultar` (otro rol → 403 aunque tenga el permiso).

| Método | Ruta | Permiso | Query | Respuesta |
|---|---|---|---|---|
| GET | `/kpis` | `Tablero / Consultar` | filtros | `{ rango, resumen, porIntegrante[], topNovedades[], concentracionTop10 }` |
| GET | `/usuarios` | `Tablero / Consultar` | — | `[{ id, nombreCompleto }]` de los responsables en soporte (igual que `/informes/usuarios`) |

Filtros (`FiltrosTableroDto`):

| Parámetro | Tipo | Regla |
|---|---|---|
| `fechaInicio` | `AAAA-MM-DD` | Inclusive. Sin fechas: **mes actual** (día 1 a hoy, hora Colombia). Con una sola, se usa para ambos extremos |
| `fechaFin` | `AAAA-MM-DD` | Inclusive. Inicio > fin o más de 366 días → **400** |
| `idUsuario` | entero, repetible | `IN` sobre el responsable |
| `motor` | `mysql` \| `postgres`, repetible | `IN` |
| `idNovedad` | entero, repetible | `IN` (filtro cruzado desde el top 10) |

## Soporte (`/api/soporte`)

`modules/soporte/soporte.controller.ts` · título `Soporte` · detalle en [10-soporte](10-soporte.md)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | `/` | `Soporte / Consultar` | paginación | Lista paginada |
| GET | `/motores` | `Soporte / Crear` | — | Pares `nombre`/`alcance` sin repetir de las conexiones activas de Configuración (select Motor) |
| GET | `/clientes` | `Soporte / Crear` | `q` (opcional, máx. 100) | Hasta 10 nombres de cliente distintos que contienen `q` (registros activos), por nombre |
| GET | `/:id` | `Soporte / Consultar` | — | Registro |
| POST | `/` | `Soporte / Crear` | `CrearSoporteDto` | Registro en estado `Creado` (no ejecuta) |
| POST | `/:id/ejecutar` | `Soporte / Editar` | — | Registro con el resultado: `estadoSoporte` `Completado` o `Error` y `descripcion` con el mensaje |
| PATCH | `/:id` | `Soporte / Editar` | `ActualizarSoporteDto` | Registro actualizado (nunca cambia `estadoSoporte`) |
| DELETE | `/:id` | `Soporte / Eliminar` | — | `data: null` |

| Campo | Crear | Actualizar |
|---|---|---|
| `cliente` | texto, obligatorio, máx. 100; se guarda con mayúscula inicial por palabra | opcional, máx. 100 |
| `idNovedad` | entero, obligatorio | opcional |
| `mensajeWhatsapp` | texto, obligatorio, 3–255 | opcional, 3–255 |
| `motor` | `mysql` \| `postgres` | opcional |
| `sentencia` | texto, obligatorio, 3–5000; debe ser solo UPDATE con WHERE o solo INSERT limpios | opcional, misma regla (se revalida con el motor final) |
| `estadoRegistro` | — | opcional |

Ejecución (`POST /:id/ejecutar`):

1. Verifica el rate limit global (configuración `rate_limit`, `requests_por_minuto`; sin fila activa no hay límite) → 429 si se supera.
2. Encola en BullMQ (concurrencia 1) y espera hasta **30 s**.
3. El resultado se guarda en el registro; un error de conexión o de la sentencia **no** es un error HTTP: responde 200 con `estadoSoporte: "Error"` y el motivo en `descripcion`.

Errores propios: sentencia no permitida → 422 (mensaje con título y detalle separados por `\n`); registro inexistente → 404; espera mayor a 30 s → 500.

---

## Dónde está en el código

| Pieza | Archivo |
|---|---|
| Arranque, prefijo, pipes, Swagger | `backend/src/main.ts` |
| Guards globales | `backend/src/app.module.ts`, `backend/src/common/auth/` |
| Decoradores | `common/auth/public.decorator.ts`, `roles.decorator.ts`, `requiere-permiso.decorator.ts`, `allow-password-change.decorator.ts`, `current-user.decorator.ts`, `common/decorators/response-title.decorator.ts`, `skip-envelope.decorator.ts` |
| Envelope | `common/envelope/envelope.util.ts`, `common/interceptors/response.interceptor.ts`, `common/filters/http-exception.filter.ts` |
| Paginación | `common/dto/paginacion-query.dto.ts` |
| CORS | `common/cors/opciones-cors.util.ts` |
| Controllers y DTO | `backend/src/modules/<módulo>/<módulo>.controller.ts`, `dto/*.ts` |
| Contrato en el frontend | `frontend/src/app/core/envelope.model.ts` |

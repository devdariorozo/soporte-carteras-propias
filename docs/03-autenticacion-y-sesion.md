# 03 · Autenticación y sesión

Login con usuario y contraseña, JWT de acceso + refresh, **una sola sesión activa por usuario** (Redis) y cambio de contraseña obligatorio en el primer ingreso.

## Login

Pantalla `/login` (pública).

| Campo | Frontend | Backend (`LoginDto`) |
|---|---|---|
| Usuario | Obligatorio (normalmente el documento sin puntos) | `string`, no vacío |
| Contraseña | Obligatoria, con botón para ver/ocultar | `string`, no vacío |

- El botón **Ingresar** queda deshabilitado mientras falte un campo.
- Enlace **¿Olvidaste tu contraseña?** → `/recuperar-password`.
- Éxito: aviso "Inicio de sesión exitoso." y navega a `/` (inicio).
- Error: se muestra el `message` del backend en un aviso rojo (amarillo si es **429**); si no llega, "No se pudo iniciar sesión, intenta de nuevo.".

| Caso | Respuesta |
|---|---|
| Usuario inexistente, inactivo (`estado_registro = 0`), eliminado o contraseña incorrecta | **401** "Usuario o contraseña incorrectos." (mismo mensaje para no revelar cuál falló) |
| Intentos fallidos agotados (ver [Límite de intentos](#límite-de-intentos-login-y-recuperar-contraseña)) | **429** "Demasiados intentos fallidos. Intenta de nuevo en N minutos." |
| Campo vacío o faltante | **400** (mensaje de validación de class-validator) |

## Límite de intentos (login y recuperar contraseña)

Frena la prueba masiva de contraseñas y de secretos. Se configura en `backend/.env` (plantilla en `backend/.env.example`):

| Variable | Qué define | Por defecto |
|---|---|---|
| `LOGIN_MAX_INTENTOS` | Intentos **fallidos** permitidos por usuario dentro de la ventana. `0` = sin límite | `5` |
| `LOGIN_VENTANA_MINUTOS` | Duración de la ventana, en minutos | `15` |

Vacías o con un valor que no sea un entero ≥ 0 usan el valor por defecto. Se leen en cada intento; en Docker, tras cambiarlas hay que recrear `api` (`up -d api`) para que tome el `.env`.

Cómo funciona (`AuthService`, `backend/src/modules/auth/auth.service.ts`):

1. Contador por **acción y usuario** en Redis: `rate_limit:auth:login:<usuario>` y `rate_limit:auth:recuperar:<usuario>` (independientes). La ventana empieza con el **primer fallo** y expira sola.
2. Antes de comparar la contraseña (o el secreto): si el usuario ya agotó sus intentos → **429**, aunque ahora la clave sea la correcta.
3. Cada fallo (usuario inexistente, inactivo, sin secreto o clave incorrecta) suma 1. **El fallo que agota el límite ya responde 429** (no 401), para que el usuario sepa cuánto esperar.
4. Un acierto borra el contador.
5. Mensaje: `Demasiados intentos fallidos. Intenta de nuevo en N minutos.`, con N = minutos que le quedan a la ventana (redondeado hacia arriba, mínimo 1).

Ejemplo con 5 / 15: cuatro fallos → 401; el quinto → 429; durante lo que quede de los 15 minutos desde el primer fallo, todo intento → 429; después vuelve a contar desde cero.

- Es **por usuario**, no por IP: todo el equipo sale a internet por la misma IP corporativa y un límite por IP bloquearía a todos. Contrapartida: alguien que conozca un usuario puede bloquearlo durante la ventana escribiendo mal su contraseña; el bloqueo se levanta solo.
- Para desbloquear antes de tiempo: borrar la clave en Redis (`docker compose ... exec redis redis-cli DEL rate_limit:auth:login:<usuario>`) o esperar la ventana.
- No aplica a `refresh` ni a los endpoints autenticados. El otro límite del sistema es el de ejecuciones de Soporte (ver [09-configuracion](09-configuracion.md#rate-limit)); ambos responden 429 ([14-api](14-api.md#429-límite-excedido)).

### Datos de equipo guardados en cada login

El backend lee el header `User-Agent` (lo envía el navegador) con `ua-parser-js` y actualiza en `usuarios`:

| Columna | Valor |
|---|---|
| `ultimo_tipo_equipo` | `Móvil` (móvil o tablet) o `PC` (todo lo demás) |
| `ultimo_navegador` | Nombre + versión (ej. `Chrome 140.0.0.0`), o `NULL` si no se reconoce |
| `ultimo_sistema_operativo` | Nombre + versión (ej. `Windows 10`), o `NULL` |
| `ultima_fecha_login` | Fecha y hora del login |

Solo se guardan; hoy ninguna pantalla los muestra.

## Tokens

| Token | Duración (`backend/.env`) | Secreto | Contenido (payload) | Uso |
|---|---|---|---|---|
| Access | `JWT_ACCESS_EXPIRES_IN` (por defecto `15m`) | `JWT_ACCESS_SECRET` | `sub` (id usuario), `usuario`, `rol`, `idRol`, `sid`, `debeCambiarPassword` | Header `Authorization: Bearer <token>` en cada petición |
| Refresh | `JWT_REFRESH_EXPIRES_IN` (por defecto `12h`) | `JWT_REFRESH_SECRET` | `sub`, `sid` | Solo `POST /api/auth/refresh`; se **rota** en cada renovación |

- Secretos distintos para access y refresh: uno filtrado no sirve para el otro. Se definen por ambiente (ver `backend/.env.example`, ej. `openssl rand -hex 48`).
- Formato de duración: número + `s`/`m`/`h`/`d` (ej. `15m`, `12h`). Otro formato hace fallar el login.
- `expiresIn` de la respuesta viene en **segundos** (vida del access token).

### Dónde se guardan en el frontend

`localStorage` del navegador (compartido por todas las pestañas del mismo origen):

| Clave | Contenido |
|---|---|
| `scp_access_token` | Access token |
| `scp_refresh_token` | Refresh token |
| `scp_usuario` | Usuario autenticado (`id`, `usuario`, `primerNombre`, `primerApellido`, `rol`, `idRol`, `debeCambiarPassword`) |

## Sesión única por usuario

Cada login y cada renovación generan un `sid` nuevo (UUID) que se guarda en dos lugares:

| Dónde | Clave / columna | Vence |
|---|---|---|
| Redis | `auth:session:<idUsuario>` | TTL = duración del refresh (se reinicia en cada renovación) |
| MySQL | `usuarios.refresh_token` (guarda el `sid`, no el token) | — |

Reglas:

- **Cada petición** (`JwtAuthGuard`) compara el `sid` del access token con el de Redis. Si no coincide o no existe → **401** "La sesión fue cerrada o reemplazada por un nuevo inicio de sesión.".
- **El refresh** exige además que el `sid` coincida con `usuarios.refresh_token` y que el usuario siga activo. Así, tras un logout, un restablecimiento o una base reconstruida, un `sid` viejo que quede en Redis no sirve.
- **Login en otro equipo o navegador:** el `sid` nuevo reemplaza al anterior. En el equipo viejo la siguiente petición recibe 401, el intento de renovación también falla y la app lo envía al login (el aviso que se ve es el error de la pantalla donde estaba).
- **Otra pestaña del mismo navegador:** no es otra sesión; comparte `localStorage` (ver abajo).

## Renovación automática (frontend)

`frontend/src/app/core/services/auth.service.ts`

| Disparador | Qué hace |
|---|---|
| Temporizador cada **14 min** | Llama a `/api/auth/refresh`. Un fallo de red no cierra la sesión (se reintenta después); un 401 sí. |
| Volver a la pestaña (`visibilitychange`, `focus`, `online`) | Renueva de inmediato si al access token le quedan **menos de 2 min** (el navegador congela los temporizadores con el equipo suspendido o la pestaña en segundo plano). No aplica mientras falte el cambio de contraseña obligatorio. |
| Respuesta **401** en cualquier petición | El interceptor renueva y reintenta **una vez**. Si la renovación responde 401 (o no hay refresh token), cierra la sesión local y va al login. |
| Abrir o recargar la app | `validarSesionGuardada()` (en `provideAppInitializer`, `app.config.ts`) hace un refresh antes de la primera ruta; si falla por cualquier motivo, limpia la sesión local y el `authGuard` envía al login. Luego espera la carga de permisos. |

- **Una renovación a la vez:** las llamadas simultáneas comparten la misma promesa; entre pestañas se serializan con Web Locks (`navigator.locks`, candado `scp-refresh`) cuando el navegador lo soporta.
- **Varias pestañas:** el evento `storage` sincroniza las demás. Si otra pestaña renovó, esta adopta sus tokens (y si el backend rechazó el refresh porque otra pestaña ganó la carrera, también los adopta en vez de cerrar). Si otra pestaña cerró sesión, esta va al login. Si en otra pestaña entró un usuario distinto, esta toma ese usuario y recarga permisos.
- **Sin cierre por inactividad:** mientras la app esté abierta y renueve, la sesión sigue. Si pasa más de la duración del refresh (12 h por defecto) sin ninguna renovación, vence.
- El intervalo de 14 min está fijo en el código: si se cambia `JWT_ACCESS_EXPIRES_IN` a menos de 14 min, el reintento ante 401 sigue cubriendo el hueco.

## Cierre de sesión

- Menú de usuario en la barra lateral → **Cerrar sesión** (`POST /api/auth/logout`).
- Backend: borra `auth:session:<id>` en Redis y pone `usuarios.refresh_token = NULL`. El access token deja de servir de inmediato, aunque no haya vencido.
- Frontend: primero navega a `/login` y después limpia `localStorage`, permisos y temporizador (en orden inverso la pantalla actual alcanzaba a pedir datos sin token). Si el logout falla (token ya inválido), igual limpia.
- Las demás pestañas del navegador también salen (evento `storage`).

## Primer ingreso y cambio de contraseña

Usuario nuevo (`debe_cambiar_password = 1` al crearlo), el Super Administrador del seed, o usuario con contraseña restablecida por un administrador:

1. El login responde normal, con `usuario.debeCambiarPassword: true` (también va en el access token).
2. `JwtAuthGuard` responde **403** "Debes actualizar tu contraseña antes de continuar." a todo endpoint excepto los marcados con `@AllowDuringForcedPasswordChange()`: `POST /api/auth/cambiar-password` y `POST /api/auth/logout`.
3. El frontend oculta la barra lateral y abre el modal **Actualiza tu contraseña** (global, en `app.html`) sin opción de cerrarlo (sin X, sin Escape, sin clic afuera). Texto: "Primer acceso: define una contraseña y un secreto que solo tú conocerás.". No carga permisos hasta terminar.
4. Al guardar: el backend guarda contraseña y secreto (bcrypt, 10 rondas), pone `debe_cambiar_password = 0`; el frontend hace un refresh para obtener un access token sin la marca y carga los permisos.

El mismo modal se abre **voluntariamente** desde el menú de usuario → **Actualizar contraseña** (ahí sí se puede cerrar).

| Campo del modal | Regla | Mensaje |
|---|---|---|
| Contraseña actual | Obligatoria | "Ingresa tu contraseña actual." |
| Contraseña nueva | Política de contraseña segura + medidor | Lista de requisitos en vivo |
| Confirmar contraseña nueva | Obligatoria, igual a la nueva (solo en frontend) | "Confirma la contraseña nueva." / "Las contraseñas no coinciden." |
| Secreto de recuperación | Obligatorio, 3–45 caracteres | "El secreto de recuperación es obligatorio." / "Mínimo 3 caracteres." / "Máximo 45 caracteres." |

- Contraseña actual incorrecta → **400** "La contraseña actual no es correcta." (400 y no 401, para que el interceptor no cierre la sesión).
- Éxito → "Contraseña actualizada correctamente.".
- Cambiar la contraseña **no** cierra la sesión actual.

## Secreto de recuperación

- Obligatorio en todo cambio de contraseña; reemplaza al anterior. 3–45 caracteres. Se guarda con bcrypt (nunca se devuelve).
- Queda en `NULL` al crear el usuario y al restablecer su contraseña: hasta que el usuario lo defina, no puede usar **Recuperar contraseña**.

## Recuperar contraseña

Pantalla `/recuperar-password` (pública): "Ingresa tu usuario y el secreto que definiste en tu primer acceso."

| Campo | Regla |
|---|---|
| Usuario | Obligatorio (placeholder "Número de documento") |
| Secreto | Obligatorio, 3–45 caracteres |
| Contraseña nueva | Política de contraseña segura + medidor |

- Usuario inexistente, inactivo, sin secreto o secreto incorrecto → **401** "Usuario o secreto incorrectos.".
- Intentos fallidos agotados → **429** (mismo límite que el login, con su propio contador; ver [Límite de intentos](#límite-de-intentos-login-y-recuperar-contraseña)). El aviso sale en amarillo.
- Éxito → "Contraseña recuperada correctamente, ya puedes iniciar sesión." (el frontend muestra "Contraseña recuperada, ya puedes iniciar sesión.") y vuelve a `/login`.
- Solo cambia la contraseña: el secreto y la sesión activa (si la hay) se conservan.

## Restablecer contraseña (asistido)

Lo hace un Super Administrador o Administrador desde **Usuarios** (botón de llave). Detalle en [06-usuarios](06-usuarios.md#restablecer-contraseña).

## Contraseña segura

Misma regla en frontend (`core/validators/password-strength.ts`) y backend (`common/validators/password-segura.ts`). Aplica a: contraseña nueva (cambio y recuperación), contraseña temporal al crear usuario y al restablecer.

| Requisito | Regla |
|---|---|
| Longitud | Mínimo 8 caracteres |
| Mayúscula | Al menos una (Unicode, incluye `Ñ`, `Á`…) |
| Minúscula | Al menos una |
| Número | Al menos uno |
| Carácter especial | Al menos uno: cualquier símbolo que no sea letra, número ni espacio |

- Regex backend: `/^(?=.*\p{Lu})(?=.*\p{Ll})(?=.*\p{N})(?=.*[^\p{L}\p{N}\s]).{8,}$/u`.
- Mensaje backend: "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.".
- Medidor (`shared/password-fortaleza`): barra de 3 segmentos + lista de requisitos marcados en vivo. **Débil** (≤ 2 requisitos, rojo), **Media** (3–4, ámbar), **Fuerte** (5, verde). Solo "Fuerte" pasa la validación.

## Guards

### Backend (globales, `app.module.ts`, en este orden)

| Guard | Archivo | Qué hace |
|---|---|---|
| `JwtAuthGuard` | `common/auth/jwt-auth.guard.ts` | Salta rutas `@Public()`. Exige `Bearer` válido (401 "Token no proporcionado." / "La sesión expiró o el token es inválido, por favor inicia sesión nuevamente."), `sid` igual al de Redis (401) y bloquea con 403 si `debeCambiarPassword` (salvo `@AllowDuringForcedPasswordChange()`). Deja el payload en `request.user`. |
| `RolesGuard` | `common/auth/roles.guard.ts` | Solo si el endpoint tiene `@Roles(...)`: compara el **nombre** del rol. 403 "No tienes permiso para realizar esta acción.". Hoy solo lo usa `resetear-password`. |
| `PermisosGuard` | `common/auth/permisos.guard.ts` | Solo si hay `@RequierePermiso(menu, acción)`. Ver [05-permisos](05-permisos.md). |

### Frontend (`frontend/src/app/core/guards/`)

| Guard | Qué hace |
|---|---|
| `authGuard` | Deja pasar si hay access token en memoria; si no, redirige a `/login`. No valida el token (eso lo hace el arranque y el backend). |
| `permisoGuard(modulo, accion = 'Consultar')` | Espera la carga de permisos en curso y exige `PermisosService.tiene(modulo, accion)`; si no, redirige a `/`. |

`/login` y `/recuperar-password` no tienen guard.

## Interceptores HTTP (frontend)

Registrados en `app.config.ts` en este orden: `apiBaseUrlInterceptor` → `authInterceptor` → `timeoutInterceptor`.

| Interceptor | Archivo | Qué hace |
|---|---|---|
| Base URL | `core/interceptors/api-base-url.interceptor.ts` | Si `environment.apiUrl` tiene valor, lo antepone a las rutas `/api/...`. Hoy está vacío: mismo origen (proxy de `ng serve` o nginx). |
| Auth | `core/interceptors/auth.interceptor.ts` | Agrega `Authorization: Bearer` salvo en `/api/auth/login`, `/refresh` y `/recuperar-password`. Ante 401 renueva y reintenta una vez (marca `REINTENTADA` para no ciclar); no reintenta en rutas públicas ni en `/api/auth/logout`. |
| Timeout | `core/interceptors/timeout.interceptor.ts` | Corta la petición a los **20 s** para que el preloader global no quede visible para siempre. |

**No hay interceptor de errores.** Cada pantalla captura el error y muestra en un aviso (toast) el `message` del envelope del backend, o un texto propio si no llega.

## Endpoints (`/api/auth`)

Todas las respuestas usan el envelope estándar (`status`, `title` = "Login", `message`, `data`).

| Método | Ruta | Acceso | Cuerpo | Respuesta (`data`) |
|---|---|---|---|---|
| POST | `/login` | Público | `{ usuario, password }` | `{ accessToken, refreshToken, expiresIn, usuario: { id, usuario, primerNombre, primerApellido, rol, idRol, debeCambiarPassword } }` · mensaje "Inicio de sesión exitoso." |
| POST | `/refresh` | Público (refresh token en el cuerpo) | `{ refreshToken }` | Igual que login · "Sesión renovada." |
| POST | `/recuperar-password` | Público | `{ usuario, secreto, passwordNueva }` | `null` · "Contraseña recuperada correctamente, ya puedes iniciar sesión." |
| POST | `/cambiar-password` | Sesión activa (permitido con cambio obligatorio pendiente) | `{ passwordActual, passwordNueva, secretoNuevo }` | `null` · "Contraseña actualizada correctamente." |
| POST | `/resetear-password/:idUsuario` | `@Roles` Super Administrador o Administrador + jerarquía | `{ passwordTemporal }` | `null` · "Contraseña temporal asignada. El usuario deberá definir contraseña y secreto nuevos al ingresar." |
| POST | `/logout` | Sesión activa (permitido con cambio obligatorio pendiente) | `{}` | `null` · "Sesión cerrada correctamente." |

Errores de `/refresh` (todos **401**): "El refresh token es inválido o expiró." · "La sesión fue cerrada o reemplazada por un nuevo inicio de sesión." · "Usuario no encontrado o inactivo." · "La sesión ya no es válida, inicia sesión nuevamente.".

Errores de `/resetear-password`: **404** "Usuario no encontrado." · **403** "No puedes restablecer la contraseña de un usuario con un rol por encima del tuyo." · **403** por `RolesGuard` si el rol no es Super Administrador ni Administrador.

El `ValidationPipe` global usa `whitelist` + `forbidNonWhitelisted`: un campo extra en el cuerpo responde 400.

## Código

| Parte | Ruta |
|---|---|
| Controller / servicio / DTOs | `backend/src/modules/auth/` |
| Guards, decoradores, payload JWT | `backend/src/common/auth/` |
| Sesión en Redis | `backend/src/common/redis/redis.service.ts` |
| Política de contraseña | `backend/src/common/validators/password-segura.ts` |
| Servicio de sesión (frontend) | `frontend/src/app/core/services/auth.service.ts` |
| Guards / interceptores | `frontend/src/app/core/guards/` · `frontend/src/app/core/interceptors/` |
| Pantallas | `frontend/src/app/features/auth/login/` · `frontend/src/app/features/auth/recuperar-password/` |
| Modal de cambio | `frontend/src/app/shared/cambiar-password-modal/` (+ `core/services/cambiar-password-ui.service.ts`) |
| Medidor | `frontend/src/app/shared/password-fortaleza/` · `frontend/src/app/core/validators/password-strength.ts` |

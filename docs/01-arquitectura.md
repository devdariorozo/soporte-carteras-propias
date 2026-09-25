# 01 · Arquitectura

## Componentes

| Servicio (Compose) | Tecnología | Función | Puerto en el host |
|---|---|---|---|
| `web` | Angular 21 + PrimeNG 21 + Tailwind 4, compilado y servido por nginx | Interfaz; reenvía `/api` al contenedor `api` | Desarrollo: 6001 · QA/PRO: 7001 |
| `api` | NestJS 12 + TypeORM (Node 22) | API REST bajo `/api`, reglas de negocio, worker de la cola de ejecución | Desarrollo: 6002 · QA/PRO: 7002 (interno 3000) |
| `mysql` | MySQL 8.0 | Base del sistema (`dbd_` / `dbq_` / `dbp_soporte_carteras_propias`) | Desarrollo: 3360 · QA/PRO: solo `127.0.0.1:3371` |
| `redis` | Redis 7 (alpine) | Sesión activa por usuario, cola BullMQ, contador del rate limit | Desarrollo: 3361 · QA/PRO: solo `127.0.0.1:3372` |

Servidores externos (no los administra el sistema): las **bases de las carteras**, donde Soporte ejecuta los `UPDATE` e `INSERT`:

| Motor | Qué es | Cómo se llega |
|---|---|---|
| `mysql` | "Carteras Propias V1" | Directo; requiere la VPN corporativa en la máquina del contenedor `api` |
| `postgres` | PostgreSQL (ej. AWS RDS) | Directo o por túnel SSH a través de un bastión (llave en `SSH_KEY_PATH`) |

Los datos de conexión viven en la tabla `configuracion` (filas `mysql` y `postgres`), no en el `.env`. Detalle: [09-configuracion](09-configuracion.md).

```
Navegador ──► web (nginx :80 → host :6001 dev / :7001 QA-PRO)
                 │  /api/*  (mismo origen)
                 ▼
              api (NestJS :3000) ──► mysql (base del sistema)
                 │        ▲
                 │        └── redis (sesión, cola, rate limit)
                 ▼
              bases de las carteras (MySQL por VPN / PostgreSQL directo o por bastión SSH)
```

## Carpetas del backend (`backend/src/`)

| Ruta | Qué hace |
|---|---|
| `main.ts` | Arranque: CORS (`CORS_ORIGENES`), prefijo global `api`, `ValidationPipe`, interceptor de respuesta, filtro de errores, Swagger en `/api/docs`, escucha en `PORT` |
| `app.module.ts` | Registra TypeORM, JWT, BullMQ (conexión a Redis), módulos y los 3 guards globales (`APP_GUARD`) |
| `health/` | `GET /api/health` público: `{ status: 'ok', timestamp }` |
| `database/data-source.ts` | Conexión TypeORM a MySQL (variables `DB_*`, `timezone: 'Z'`, `SnakeNamingStrategy`, `synchronize: false`) |
| `database/migrations/` | Migración única `1700000000000-initial-schema.ts` |
| `database/seeds/run-seed.ts` | Seed idempotente (roles, permisos, Super Administrador, configuraciones, menú, novedades) |

### Módulos (`backend/src/modules/`)

| Módulo | Ruta API | Qué hace |
|---|---|---|
| `auth` | `/api/auth` | Login, refresh, logout, cambio de contraseña, recuperación con secreto, restablecimiento asistido ([03](03-autenticacion-y-sesion.md)) |
| `usuarios` | `/api/usuarios` | CRUD de usuarios y `opciones` para selects, respetando la jerarquía ([06](06-usuarios.md)) |
| `roles` | `/api/roles` | CRUD de roles y `opciones`; el id define la jerarquía ([04](04-roles-y-jerarquia.md)) |
| `permisos` | `/api/permisos` | CRUD de la matriz rol × menú × acción y `mis-permisos` del usuario autenticado ([05](05-permisos.md)) |
| `menu` | `/api/menu` | CRUD de la barra lateral y `activos` ([07](07-menu.md)) |
| `novedades` | `/api/novedades` | CRUD del catálogo de tipos de caso y `opciones` ([08](08-novedades.md)) |
| `configuracion` | `/api/configuracion` | Parámetros JSON versionados por `nombre`; al crear una versión se desactiva la anterior ([09](09-configuracion.md)) |
| `soporte` | `/api/soporte` | Casos, autocompletado de `clientes`, `:id/ejecutar` (cola BullMQ + worker `ejecucion.processor.ts`) ([10](10-soporte.md)) |
| `informes` | `/api/informes` | Listado filtrado, `usuarios`, `resumen` y `exportar` a Excel ([11](11-informes.md)) |

### Transversales (`backend/src/common/`)

| Carpeta | Qué hace |
|---|---|
| `auth/` | `JwtAuthGuard`, `RolesGuard`, `PermisosGuard`; decoradores `@Public`, `@Roles`, `@RequierePermiso`, `@AllowDuringForcedPasswordChange`, `@CurrentUser`; `jerarquia-roles.util.ts` (quién gestiona a quién); payload del JWT |
| `cors/` | `opciones-cors.util.ts`: arma la política CORS desde `CORS_ORIGENES` |
| `decorators/` | `@ResponseTitle` (título del envelope) y `@SkipEnvelope` (respuestas binarias) |
| `dto/` | `PaginacionQueryDto` (`page`, `limit`, enteros ≥ 1) |
| `entities/` | `AuditableBaseEntity`: `id` + columnas de auditoría comunes |
| `envelope/` | Tipos y constructores del envelope estándar y del bloque `pagination` |
| `filters/` | `HttpExceptionFilter`: toda excepción sale como envelope de error |
| `interceptors/` | `ResponseInterceptor`: envuelve toda respuesta exitosa en el envelope |
| `raw-db/` | Conexiones crudas (sin TypeORM) a las bases de las carteras: `raw-mysql.service.ts`, `raw-postgres.service.ts`, `tunel-ssh.ts`, `error-sentencia.ts` |
| `redis/` | `RedisService` (global): sesión activa `auth:session:<idUsuario>` y contador atómico por ventana |
| `sql/` | `sentencia.util.ts`: solo `UPDATE` con `WHERE` en el nivel principal o solo `INSERT INTO … (columnas) VALUES (…)` limpios, nunca mezclados, y base en la tabla; separa por `;` |
| `utils/` | `asignarDefinidos`, responsable (nombre completo por `id_usuario`), teléfono `3-3-4`, capitalización |
| `validators/` | `PASSWORD_SEGURA_REGEX`: mayúscula, minúscula, número, símbolo, mínimo 8 |

## Carpetas del frontend (`frontend/src/app/`)

| Ruta | Qué hace |
|---|---|
| `app.config.ts` | Router (recarga si cambió la versión), `HttpClient` con los 3 interceptores, PrimeNG (tema Aura) y un inicializador que valida la sesión guardada y espera los permisos antes de la primera ruta |
| `app.routes.ts` | Rutas con carga diferida; `authGuard` + `permisoGuard('<menú>')` |
| `core/envelope.model.ts` | Tipos `ResponseEnvelope` y `PaginationBlock` (espejo del backend) |
| `core/guards/` | `auth.guard.ts` (¿hay sesión? si no, `/login`) · `permiso.guard.ts` (exige `Consultar` sobre el menú; si no, `/`) |
| `core/interceptors/` | `api-base-url` (antepone `environment.apiUrl`; hoy vacío = mismo origen) · `auth` (JWT + renovación ante 401) · `timeout` (20 s) |
| `core/services/` | `auth` (tokens, sesión entre pestañas), `permisos` (`mis-permisos`), `toast`, `confirm` (confirmación de eliminar), `loading` (preloader global), `cambiar-password-ui`, `layout` (menú lateral: contraído en PC, panel en móvil) |
| `core/utils/` | Jerarquía de roles, motores, portapapeles, recarga por versión, regla de sentencia (espejo del backend), capitalización, `limite-excedido` (¿es un 429?) |
| `core/validators/` | `password-strength.ts`: requisitos y nivel Débil / Media / Fuerte |
| `features/` | Una carpeta por pantalla: `auth/login`, `auth/recuperar-password`, `home`, `roles`, `permisos`, `usuarios`, `menu`, `novedades`, `configuracion`, `soporte`, `informes` |
| `shared/` | `nav-bar` (sidebar por permisos, responsive), `footer`, `alerta-resultado` (éxito/error/advertencia/info con Copiar), `cambiar-password-modal` (obligatorio o voluntario), `password-fortaleza` (medidor), `pipes/vacio.pipe.ts` (`---` en celdas vacías), `directives/tabla-responsiva.directive.ts` (tablas como tarjetas en móvil) |
| `frontend/src/environments/` | `apiUrl: ''` en todos los ambientes |

## Flujo de una petición

1. **Navegador → nginx.** La app llama a `/api/...` en su mismo origen. nginx (`frontend/nginx.conf`, `location ^~ /api/`) la reenvía a `http://api:3000`. En `ng serve` lo hace `frontend/proxy.conf.json` hacia `localhost:6002`.
2. **Interceptores del frontend (salida)**, en este orden (`app.config.ts`):
   - `apiBaseUrlInterceptor`: con `apiUrl` vacío no cambia nada.
   - `authInterceptor`: agrega `Authorization: Bearer <access>` salvo en `login`, `refresh` y `recuperar-password`.
   - `timeoutInterceptor`: corta la petición a los 20 s.
3. **API:** CORS → prefijo `api` → guards globales, en orden:
   1. `JwtAuthGuard`: salta las rutas `@Public`. Si no, valida el JWT con `JWT_ACCESS_SECRET` y compara su `sid` con el de Redis (sesión única). Si `debeCambiarPassword` es verdadero, solo deja pasar las rutas `@AllowDuringForcedPasswordChange` (cambiar contraseña y logout): 403.
   2. `RolesGuard`: solo actúa donde hay `@Roles(...)` (hoy: restablecer contraseña asistido, Super Administrador y Administrador).
   3. `PermisosGuard`: con `@RequierePermiso(menú, acción)` exige una fila activa en `permisos` para el `idRol` del token: 403 si no existe.
4. **`ValidationPipe`** global: `whitelist`, `forbidNonWhitelisted` y `transform`. Un campo de más o inválido da 400.
5. **Controller → service:** el servicio aplica las reglas (jerarquía, duplicados, sentencia `UPDATE`/`INSERT`) y devuelve `{ message?, data?, pagination? }`.
6. **`ResponseInterceptor`** arma el envelope de éxito. Cualquier excepción la captura **`HttpExceptionFilter`** y la convierte en envelope de error.
7. **Interceptores del frontend (vuelta):** ante un 401 (salvo rutas públicas y `logout`), `authInterceptor` renueva la sesión con el refresh token y reintenta **una vez**. Si la renovación falla, cierra la sesión. Las vistas muestran `message` del envelope en toasts o en `alerta-resultado`.

## Envelope estándar

`backend/src/common/envelope/envelope.util.ts`, `common/interceptors/response.interceptor.ts`, `common/filters/http-exception.filter.ts`.

| Campo | Éxito | Error |
|---|---|---|
| `status` | `success` | `error` |
| `title` | `@ResponseTitle` del controller (ej. `Soporte`); si no hay, `Sistema` | `title` del cuerpo de la excepción; si no hay, `Sistema` |
| `message` | El del servicio; si no hay, `Operación exitosa.` | El de la excepción. Si es un arreglo (errores de validación), se unen con espacio. Si no es `HttpException`: `Ocurrió un error inesperado.` (y se registra en el log) |
| `data` | `data` del servicio o `null` | `null` |
| `pagination` | Solo en listados: `{ total, page, limit, total_pages }` (`total_pages` ≥ 1) | `null` |

Reglas:
- Un servicio que quiere un título de dominio en el error lanza `new HttpException({ title: 'Usuarios', message: '...' }, status)` (o `ConflictException`, `NotFoundException`, etc. con el mismo cuerpo).
- El servicio devuelve un objeto con `message`, `data` o `pagination`. Si devuelve otra cosa, esa cosa completa va en `data`.
- `@SkipEnvelope()` deja la respuesta sin envelope. Solo lo usa `GET /api/informes/exportar` (Excel binario).
- Paginación por defecto: `page=1`, `limit=10`.

## Cola de ejecución de sentencias (BullMQ)

`backend/src/modules/soporte/` (`soporte.service.ts`, `ejecucion.processor.ts`, `ejecucion.constants.ts`).

| Aspecto | Valor |
|---|---|
| Cola | `ejecucion-sentencias` (Redis de `REDIS_HOST`/`REDIS_PORT`) |
| Worker | `EjecucionProcessor`, en el mismo proceso de la API, `concurrency: 1`: una sentencia a la vez en toda la API |
| Espera HTTP | `POST /api/soporte/:id/ejecutar` encola el trabajo `ejecutar` y espera su fin con `waitUntilFinished` hasta **30 s** (`TIMEOUT_EJECUCION_MS`). Luego responde el caso actualizado |
| Rate limit | Antes de encolar: si hay una configuración activa `rate_limit` con `requests_por_minuto`, se aplica un contador global en Redis por minuto. Si se supera: 429. Si no existe esa configuración, no hay límite |
| Estados | El worker pasa el caso a `En proceso` y termina en `Completado` o `Error`, siempre guardado en `soporte.descripcion` con el mensaje |
| Timeouts de la cadena | frontend 20 s · API 30 s · nginx `proxy_read_timeout 90s` |

Como el worker vive dentro de la API, cualquier proceso que use el mismo Redis consume trabajos de la cola. Por eso las pruebas e2e piden detener el contenedor `api` ([13](13-despliegue-y-operacion.md#pruebas)).

## Swagger

- `http://localhost:6002/api/docs` (directo a la API; QA/PRO: `:7002`).
- También responde por nginx en `http://localhost:6001/api/docs` (QA/PRO: `:7001`), porque queda bajo `/api/`.
- Autenticación con **Authorize** → `Bearer <accessToken>`.

# 13 · Despliegue y operación

## Ambientes

| Ambiente | Archivo | Proyecto Compose | Base | Volumen MySQL | Red |
|---|---|---|---|---|---|
| Desarrollo | `docker-compose-dev.yml` | `soporte-carteras-propias-dev` | `dbd_soporte_carteras_propias` | `soporte-carteras-propias-dev-mysql-data` | `soporte-carteras-propias-dev-network` |
| QA / PRO | `docker-compose.yml` | `soporte-carteras-propias` | `dbq_` / `dbp_soporte_carteras_propias` | `soporte-carteras-propias-mysql-data` | `soporte-carteras-propias-network` |

- Cada ambiente tiene contenedores, imágenes, red y volumen propios. Desarrollo usa el prefijo `soporte-carteras-propias-dev-` (ej. `soporte-carteras-propias-dev-api`). Reconstruir desarrollo nunca toca QA/PRO.
- QA y PRO usan el mismo archivo, cada uno en su servidor con su propio `backend/.env`. Lo que cambia es `DB_NAME`, secretos y superadmin.
- Cada ambiente publica sus propios puertos (desarrollo 60xx/336x, QA/PRO 700x/337x): pueden correr a la vez en una misma máquina.

### Qué publica cada uno

| Servicio | Desarrollo (`docker-compose-dev.yml`) | QA / PRO (`docker-compose.yml`) |
|---|---|---|
| `web` | `6001:80` | `7001:80` |
| `api` | `6002:3000` | `7002:3000` |
| `mysql` | `3360:3306` (todas las interfaces) | `127.0.0.1:3371:3306` (solo esta máquina) |
| `redis` | `3361:6379` | `127.0.0.1:3372:6379` (solo esta máquina; Redis no tiene contraseña) |

Dentro del contenedor la API siempre escucha en 3000: Compose fija `PORT: 3000` y nginx reenvía a `api:3000`. El `PORT=6002` de `backend/.env` solo aplica al correr la API sin Docker.

### Diferencias

| | Desarrollo | QA / PRO |
|---|---|---|
| Etapa del Dockerfile de `api` | `dev` (`entrypoint.dev.sh`, `nest start --watch`) | `runtime` (`entrypoint.sh`, `node dist/main.js`) |
| Código de la API | Monta `./backend/src` y `./backend/test` → cambios sin reconstruir (`WATCHPACK_POLLING=true`) | Compilado en la imagen: reconstruir para desplegar |
| Frontend | Compilado (nginx): tras cambiar `frontend/` hay que reconstruir `web` | Igual |
| Volúmenes | `mysql_data` + `src` + `test` + llave SSH | `mysql_data` + llave SSH |
| Reinicio | `unless-stopped` en todos | Igual |

Dependencias de arranque: `api` espera a `mysql` *healthy* (`mysqladmin ping` cada 5 s, 10 reintentos) y a `redis` iniciado. `web` depende de `api`.

## Variables de entorno

**Único archivo:** `backend/.env`. La plantilla es `backend/.env.example`. **No hay `.env` en la raíz** (está en `.gitignore`, igual que `backend/.env`).

- Lo leen la API (`dotenv/config` en `data-source.ts` y `run-seed.ts`, y `env_file` en Compose) y el contenedor `mysql`. Este último arma `MYSQL_ROOT_PASSWORD` desde `DB_PASSWORD` y `MYSQL_DATABASE` desde `DB_NAME`.
- **Todos los comandos `docker compose` llevan `--env-file backend/.env`.** Así Compose interpola `${SSH_KEY_PATH}` en el volumen de la llave. Sin esa opción monta `/dev/null` y el túnel SSH falla con "La llave SSH está vacía".
- Contraseñas y secretos van entre comillas simples (ej. `DB_PASSWORD='TU_PASSWORD_AQUI'`).

| Variable | Propósito | Ejemplo / valor por defecto |
|---|---|---|
| `PORT` | Puerto de la API sin Docker (en Docker se fuerza 3000) | `6002` |
| `DB_HOST` | Host de MySQL. Tradicional: `localhost`. Docker: lo fuerza Compose a `mysql` | `localhost` |
| `DB_PORT` | Puerto de MySQL. Tradicional: `3360` (dev). Docker: `3306` (forzado) | `3360` |
| `DB_USER` | Usuario de MySQL. En Docker debe ser `root`: el contenedor solo crea `root` | `root` |
| `DB_PASSWORD` | Contraseña de MySQL y `MYSQL_ROOT_PASSWORD` del contenedor. No puede quedar vacía con Docker: la imagen `mysql` no inicializa sin contraseña root | `'TU_PASSWORD_AQUI'` |
| `DB_POOL_SIZE` | Conexiones del pool de TypeORM | `10` |
| `DB_NAME` | Base del ambiente | `dbd_` / `dbq_` / `dbp_soporte_carteras_propias` |
| `REDIS_HOST` | Host de Redis. Tradicional: `localhost`. Docker: `redis` (forzado) | `localhost` |
| `REDIS_PORT` | Puerto de Redis. Tradicional: `3361` (dev). Docker: `6379` (forzado) | `3361` |
| `JWT_ACCESS_SECRET` | Firma del access token. Uno por ambiente (`openssl rand -hex 48`) | `TU_SECRETO_ACCESS_AQUI` |
| `JWT_REFRESH_SECRET` | Firma del refresh token. Distinto del de access | `TU_SECRETO_REFRESH_AQUI` |
| `JWT_ACCESS_EXPIRES_IN` | Vida del access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Vida del refresh token y TTL de la sesión en Redis (jornada laboral) | `12h` |
| `LOGIN_MAX_INTENTOS` | Intentos fallidos de login / recuperar contraseña permitidos por usuario en la ventana; luego **429**. `0` = sin límite ([03](03-autenticacion-y-sesion.md#límite-de-intentos-login-y-recuperar-contraseña)) | `5` |
| `LOGIN_VENTANA_MINUTOS` | Duración de esa ventana, en minutos | `15` |
| `SEED_SUPERADMIN_DOCUMENTO` | Documento del Super Administrador inicial. También es su `usuario` de login. Obligatoria | `1000000000` |
| `SEED_SUPERADMIN_NOMBRE` | Primer nombre. Obligatoria | `Nombre` |
| `SEED_SUPERADMIN_SEGUNDO_NOMBRE` | Segundo nombre. Opcional | |
| `SEED_SUPERADMIN_APELLIDO` | Primer apellido. Obligatoria | `Apellido` |
| `SEED_SUPERADMIN_SEGUNDO_APELLIDO` | Segundo apellido. Opcional | |
| `SEED_SUPERADMIN_NUMERO_CONTACTO` | Teléfono de 10 dígitos (se guarda `3-3-4`). Obligatoria | `'3000000000'` |
| `SEED_SUPERADMIN_CORREO` | Correo. Obligatoria | `admin@ejemplo.com` |
| `SEED_SUPERADMIN_PASSWORD` | Contraseña inicial. Se pide cambiarla al entrar. Obligatoria | `'TU_PASSWORD_AQUI'` |
| `SSH_KEY_PATH` | Ruta **en esta máquina** de la llave privada del bastión (PostgreSQL por túnel). Tradicional: la API la lee directo. Docker: se monta en `/run/secrets/bastion_key:ro` | `/home/usuario/.ssh/bastion_key` |
| `CORS_ORIGENES` | `*` = cualquier origen. Si no, URLs separadas por coma. Vacío = ningún origen cruzado | `http://localhost:6001,http://localhost:4200` |

Las `SEED_SUPERADMIN_*` solo se usan al crear el Super Administrador (base nueva). Ver [02](02-base-de-datos.md#seed-backendsrcdatabaseseedsrun-seedts).

Los dos archivos de Compose **fuerzan** en `api` (sin importar el `.env`):

| Variable | Valor | Por qué |
|---|---|---|
| `DB_HOST` / `DB_PORT` | `mysql` / `3306` | Red interna |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` | Red interna |
| `HOST_LOCAL_ALIAS` | `host.docker.internal` (con `extra_hosts: host-gateway`) | Una conexión de Soporte con host `localhost`/`127.0.0.1`/`::1` se dirige a la máquina anfitriona |
| `SSH_KEY_PATH` | `/run/secrets/bastion_key` | Ruta de la llave dentro del contenedor |
| `WATCHPACK_POLLING` | `true` (solo desarrollo) | Detecta cambios en el volumen montado |

## Imágenes

### `backend/Dockerfile` (Node 22 alpine, npm 12.0.1)

| Etapa | Qué hace | La usa |
|---|---|---|
| `build` | `npm ci` + `npm run build` (genera `dist/`) | Base de `dev` y origen de `runtime` |
| `dev` | Parte de `build` (con devDependencies y fuentes). Entrypoint `entrypoint.dev.sh` | `docker-compose-dev.yml` (`target: dev`) |
| `runtime` | `NODE_ENV=production`, `npm ci --omit=dev`, copia `dist/`. Entrypoint `entrypoint.sh` | `docker-compose.yml` (`target: runtime`) |

### `frontend/Dockerfile`

| Etapa | Qué hace |
|---|---|
| `build` | `npm ci` + `npm run build` (Node 22 alpine) |
| `runtime` | `nginx:alpine` con `dist/frontend/browser` en `/usr/share/nginx/html` y `nginx.conf` como `default.conf` |

## Entrypoints de la API

`backend/entrypoint.sh` (QA/PRO) y `backend/entrypoint.dev.sh` (desarrollo), con `set -e`:

1. **Espera MySQL:** intenta conectar con `mysql2` usando `DB_*` y reintenta cada 3 s hasta lograrlo.
2. **Migración:** `npm run migration:run:prod` / `npm run migration:run`.
3. **Seed idempotente:** `npm run seed:prod` / `npm run seed`.
4. **Arranque:** `exec node dist/main.js` / `exec npm run start:dev`.

Si la migración o el seed fallan, el contenedor sale y Compose lo reinicia (`unless-stopped`). Revisar `logs -f api`.

## nginx: mismo origen `/api`

`frontend/nginx.conf`:

| `location` | Comportamiento |
|---|---|
| `^~ /api/` | `proxy_pass http://api:3000` con cabeceras `Host`, `X-Real-IP`, `X-Forwarded-*`. `proxy_read_timeout 90s` (Soporte espera hasta 30 s) y `client_max_body_size 10m` |
| Estáticos con hash (`.js`, `.css`, fuentes, imágenes) | `try_files $uri =404`, `Cache-Control: public, max-age=31536000, immutable` |
| `/` (SPA) | `try_files $uri $uri/ /index.html`, `Cache-Control: no-cache` |

- Cabeceras en todas las respuestas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer-when-downgrade`.
- El frontend llama siempre a `/api` en su mismo origen (`environment.apiUrl = ''`). La misma imagen sirve en cualquier servidor sin configurar la URL de la API.
- Tras un despliegue, un archivo con hash viejo da 404 y la app se recarga una vez sola (`recarga-version.util.ts`).
- En `ng serve`, `frontend/proxy.conf.json` hace lo mismo hacia `http://localhost:6002`.

## CORS

`backend/src/common/cors/opciones-cors.util.ts`, aplicado en `main.ts`.

- `CORS_ORIGENES=*` acepta cualquier origen.
- Si no, lista separada por coma (ej. `http://localhost:6001,http://localhost:4200`; en QA/PRO `http://<servidor>:7001`). A cada URL se le quitan espacios y `/` final.
- Vacío o sin definir = se deniega todo origen cruzado (falla cerrado).
- Métodos permitidos fijos: `GET, POST, PATCH, DELETE, OPTIONS`. Cabeceras: `Content-Type, Authorization`.
- No necesitan estar en la lista la app servida por nginx, `ng serve` con su proxy ni el túnel Cloudflared: todos llaman a `/api` en su mismo origen. Sí la necesita un origen que llame directo a la API (`:6002` / `:7002`) desde el navegador.
- Tras cambiarlo, recrear la API:
  - Desarrollo: `docker compose --env-file backend/.env -f docker-compose-dev.yml up -d api`
  - QA/PRO: `docker compose --env-file backend/.env up -d api`
  - Tradicional: reiniciar `npm run start:dev`

## Comandos

```bash
# Desarrollo
docker compose --env-file backend/.env -f docker-compose-dev.yml build --no-cache
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d --build web   # tras cambiar frontend/
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d --build api   # tras cambiar backend/ fuera de src (package.json, Dockerfile...); src se recarga solo
docker compose --env-file backend/.env -f docker-compose-dev.yml ps
docker compose --env-file backend/.env -f docker-compose-dev.yml logs -f api
docker compose --env-file backend/.env -f docker-compose-dev.yml restart api          # corre migración + seed otra vez
docker compose --env-file backend/.env -f docker-compose-dev.yml down                # borra contenedores y red; conserva datos (-v los BORRA)
docker image rm soporte-carteras-propias-dev-api soporte-carteras-propias-dev-web    # borrar imágenes del ambiente (tras down)

# QA / PRO
docker compose --env-file backend/.env build --no-cache
docker compose --env-file backend/.env up -d
docker compose --env-file backend/.env up -d --build                                 # desplegar versión nueva (frontend y backend)
docker compose --env-file backend/.env up -d --build api                             # solo backend/
docker compose --env-file backend/.env up -d --build web                             # solo frontend/
docker compose --env-file backend/.env ps
docker compose --env-file backend/.env logs -f api
docker compose --env-file backend/.env down                                          # borra contenedores y red; conserva datos (-v los BORRA)
docker image rm soporte-carteras-propias-api soporte-carteras-propias-web            # borrar imágenes del ambiente (tras down)
```

- **Los datos no se pierden** al bajar/levantar contenedores, reconstruir imágenes o borrarlas: viven en el volumen de MySQL de cada ambiente (`soporte-carteras-propias-dev-mysql-data` / `soporte-carteras-propias-mysql-data`). Solo `down -v`, `docker volume rm` o `schema:drop` los borran. Al arrancar, migración y seed solo aplican lo que falte.
- No se usa `down --rmi all`: también borraría las imágenes de `mysql` y `redis`, compartidas por ambos ambientes.
- Cada ambiente publica su MySQL en un puerto distinto (desarrollo `localhost:3360`, QA/PRO `localhost:3371`): DBeaver puede ver ambas bases a la vez.

Migraciones, seed, consola MySQL y reconstrucción de la base: [02-base-de-datos](02-base-de-datos.md#comandos).

### Modo tradicional (sin Docker para API y frontend)

MySQL y Redis siguen en Docker (los de desarrollo). La API y el frontend corren con `npm`:

```bash
# 1. Infraestructura
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d mysql redis

# 2. API (backend/.env con PORT=6002, DB_HOST=localhost, DB_PORT=3360, REDIS_HOST=localhost, REDIS_PORT=3361)
cd backend && npm install && npm run migration:run && npm run seed && npm run start:dev   # :6002

# 3. Frontend (ng serve con proxy /api -> localhost:6002)
cd frontend && npm install && npm start                                                  # :4200
```

No levantar a la vez el contenedor `api` de desarrollo: usa el puerto 6002 y su worker compartiría la cola en Redis.

## Conectarse desde DBeaver (base del sistema)

Conexión **MySQL directa** al puerto del ambiente: desarrollo `localhost:3360`, QA/PRO `localhost:3371` (desde el propio servidor, solo escucha en `127.0.0.1`). No se usa túnel SSH.

| Ambiente | Base |
|---|---|
| Desarrollo | `dbd_soporte_carteras_propias` |
| QA | `dbq_soporte_carteras_propias` |
| PRO | `dbp_soporte_carteras_propias` |

- Host `localhost`, puerto `3360` (dev) o `3371` (QA/PRO), usuario y contraseña: `DB_USER` / `DB_PASSWORD` de `backend/.env`.
- Driver properties: `allowPublicKeyRetrieval=true`, `useSSL=false`.
- En QA/PRO MySQL escucha solo en `127.0.0.1`: accesible desde esa misma máquina, no desde la red.

## Túnel Cloudflared (acceso temporal desde fuera)

URL pública temporal `https://<aleatorio>.trycloudflare.com`, sin abrir puertos:

| Modo | Comando | Nota |
|---|---|---|
| Docker (nginx) | `cloudflared tunnel --url http://localhost:6001` (QA/PRO: `:7001`) | nginx sirve la app y `/api`: todo en el mismo origen |
| Tradicional (`ng serve`) | `cloudflared tunnel --url http://localhost:4200` | `frontend/angular.json` permite el host (`serve.options.allowedHosts: [".trycloudflare.com"]`) y el proxy lleva `/api` a `:6002` |

No requiere tocar `CORS_ORIGENES`. La URL cambia en cada ejecución y el túnel muere al cerrar el comando.

## Respaldo

```bash
# Desarrollo
docker compose --env-file backend/.env -f docker-compose-dev.yml exec -T mysql sh -c 'mysqldump -uroot -p"$DB_PASSWORD" "$DB_NAME"' > respaldo.sql
# QA / PRO
docker compose --env-file backend/.env exec -T mysql sh -c 'mysqldump -uroot -p"$DB_PASSWORD" "$DB_NAME"' > respaldo.sql
# Restaurar (misma forma, en sentido inverso)
docker compose --env-file backend/.env exec -T mysql sh -c 'mysql -uroot -p"$DB_PASSWORD" "$DB_NAME"' < respaldo.sql
```

`$DB_PASSWORD` y `$DB_NAME` se expanden **dentro** del contenedor (comillas simples), así que no quedan en el historial del host. Para desarrollo, agregar `-f docker-compose-dev.yml` también al restaurar.

## Primer uso

1. Copiar `backend/.env.example` a `backend/.env` y llenar: `DB_PASSWORD`, `DB_NAME` del ambiente, los dos `JWT_*_SECRET`, las `SEED_SUPERADMIN_*`, `CORS_ORIGENES` y, si se usa PostgreSQL por bastión, `SSH_KEY_PATH`.
2. `build` + `up -d` del ambiente (ver [Comandos](#comandos)). El primer arranque crea la base, corre la migración y el seed.
3. Abrir la app (`http://localhost:6001/login` en desarrollo, `http://<servidor>:7001/login` en QA/PRO) y entrar con el documento y la contraseña de `SEED_SUPERADMIN_*`. El sistema pide cambiar la contraseña y definir el secreto de recuperación.
4. **Configuración:** en `mysql` / `postgres`, reemplazar los datos ficticios por los del servidor de las carteras (PostgreSQL por bastión: [09-configuracion](09-configuracion.md)).
5. **Administración:** usuarios, roles y permisos.
6. **Soporte:** registrar el caso y **Registrar y ejecutar**. Con MySQL (Carteras Propias V1), la VPN corporativa debe estar conectada en la máquina del contenedor `api`.
7. **Informes:** filtrar, ver el detalle de cada fila o exportar a Excel.

## Diagnóstico rápido

| Síntoma | Causa probable / qué revisar |
|---|---|
| `api` se reinicia en bucle | `logs -f api`: MySQL inaccesible, falta una `SEED_SUPERADMIN_*` obligatoria, o la migración o el seed fallaron |
| `mysql` no queda *healthy* | `DB_PASSWORD` vacía (la imagen no inicializa sin contraseña root) o volumen creado con otra contraseña: la contraseña root solo se fija al crear el volumen |
| Soporte: "Sin conexión con Carteras Propias V1" | VPN no conectada en la máquina del contenedor `api`, o `host`/`port` incorrectos en Configuración |
| Soporte PostgreSQL: "La llave SSH está vacía" | Se levantó sin `--env-file backend/.env` o `SSH_KEY_PATH` vacío: recrear `api` con la opción |
| Soporte PostgreSQL: otro error de llave o bastión | Ver [09-configuracion](09-configuracion.md#errores-frecuentes) |
| Una conexión a `localhost` no responde (Docker) | Se resuelve a `host.docker.internal`: el servicio del anfitrión debe escuchar en `0.0.0.0`, no solo en `127.0.0.1` |
| Soporte: "Se alcanzó el límite de ejecuciones por minuto" | Configuración `rate_limit` activa (`requests_por_minuto`) |
| Login o Recuperar: "Demasiados intentos fallidos. Intenta de nuevo en N minutos." | Se agotaron `LOGIN_MAX_INTENTOS` en `LOGIN_VENTANA_MINUTOS`. Esperar, o desbloquear: `docker compose --env-file backend/.env [-f docker-compose-dev.yml] exec redis redis-cli DEL rate_limit:auth:login:<usuario>` (`recuperar` en vez de `login` para Recuperar contraseña) |
| Soporte PostgreSQL: "El servidor PostgreSQL rechazó la conexión desde este servidor (puede exigir conexión cifrada)" | En el log `no pg_hba.conf entry … no encryption`: poner `"ssl": true` en la conexión `postgres`. Si persiste, el servidor no autoriza la IP de `api`: pedir al DBA la regla en `pg_hba.conf`, o usar el túnel (`ssh_*`) |
| Soporte: "La sentencia parece de MySQL/PostgreSQL, pero el motor elegido es…" | Se eligió el motor equivocado para la sentencia ([10-soporte](10-soporte.md#reglas-de-la-sentencia), regla 7) |
| En DBeaver no aparece la base de un ambiente | Revisar el puerto: desarrollo `3360`, QA/PRO `3371` (solo desde el servidor) y que el ambiente esté levantado |
| Pantalla no carga tras desplegar | Pestaña con versión vieja: Ctrl + Shift + R |
| `port is already allocated` al levantar | El otro ambiente (o `npm run start:dev` / `ng serve`) está usando el puerto: bajarlo primero |
| CORS bloquea peticiones | El origen no está en `CORS_ORIGENES` (recrear `api` tras cambiarlo) |
| La sesión se cierra sola al entrar en otro equipo o pestaña privada | Sesión única por usuario: el login más reciente reemplaza al anterior ([03](03-autenticacion-y-sesion.md)) |
| Salud de la API | `curl http://localhost:6002/api/health` (QA/PRO: `:7002`) → `status: ok` |

## Pruebas

Backend (`backend/`, Vitest):

| Comando | Config | Qué corre |
|---|---|---|
| `npm run test` | `vitest.config.ts` (`**/*.spec.ts`) | Unitarias. Hoy **no hay** archivos `*.spec.ts` en el backend: Vitest responde "No test files found" |
| `npm run test:e2e` | `vitest.config.e2e.ts` (`**/*.e2e-spec.ts`) | `test/app.e2e-spec.ts` (health) y `test/flujo-completo.e2e-spec.ts` (login → novedad → soporte → ejecutar → informes) |

Requisitos de las e2e:
- Corren en el host contra la base y el Redis de `backend/.env`: `DB_HOST=localhost`, `DB_PORT=3360`, `REDIS_HOST=localhost`, `REDIS_PORT=3361`.
- `mysql` y `redis` levantados, con la migración y el seed ya corridos.
- El Super Administrador debe poder entrar con `SEED_SUPERADMIN_DOCUMENTO` / `SEED_SUPERADMIN_PASSWORD`.
- Detener antes el contenedor `api`, porque comparte Redis y su worker tomaría los trabajos de la cola: `docker compose --env-file backend/.env -f docker-compose-dev.yml stop api`.
- `test/utils/crear-app.ts` replica el bootstrap de `main.ts` (prefijo, pipe, interceptor, filtro), sin CORS ni Swagger.
- El flujo completo crea una configuración `mysql` temporal apuntando a la propia base y al terminar la elimina y reactiva la anterior.

```bash
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d mysql redis
docker compose --env-file backend/.env -f docker-compose-dev.yml stop api
cd backend && npm run test:e2e
```

Frontend (`frontend/`): `npm test` (`ng test`, builder `@angular/build:unit-test`; `vitest` y `jsdom` en devDependencies). Hoy solo tiene `src/app/app.spec.ts`.

# Soporte Carteras Propias

Sistema para registrar y resolver casos de soporte de las carteras propias: el equipo registra el caso del cliente, ejecuta la sentencia (`UPDATE` o `INSERT`) que lo corrige contra la base de la cartera y obtiene el mensaje de cierre para el cliente, con control de acceso y trazabilidad.

Documentación detallada por funcionalidad: [`docs/`](docs/README.md).

## ¿Para qué es?

- **Soporte:** registrar el caso (cliente, novedad, mensaje de WhatsApp, motor, sentencia) y ejecutarlo de forma segura: solo `UPDATE` con `WHERE` o solo `INSERT INTO tabla (columnas) VALUES (...)` limpios (nunca mezclados), en transacción (todo o nada).
- **Tablero:** KPIs del rango de fechas — indicadores generales, quién hace más soportes y top 10 de novedades (solo Super Administrador y Administrador).
- **Informes:** consultar, filtrar y exportar a Excel los casos, con la sentencia y el resultado de cada uno.
- **Administración:** usuarios, roles con jerarquía, permisos por menú y acción, menú, novedades y configuración.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21, PrimeNG 21, Tailwind CSS 4, Apache ECharts (Tablero), servido con nginx |
| Backend | NestJS 12, TypeORM, JWT, BullMQ, Swagger (Node 22) |
| Base del sistema | MySQL 8.0 |
| Sesiones y colas | Redis 7 |
| Bases de las carteras | MySQL y PostgreSQL (drivers `mysql2` y `pg`) |
| Infraestructura | Docker y Docker Compose |

## Arquitectura

```
Navegador ──► web (Angular + nginx) ──► api (NestJS /api) ──┬─► mysql (base del sistema)
                                                             ├─► redis (sesión y cola)
                                                                       └─► BD de las carteras (MySQL/PostgreSQL, vía VPN)
```

```
backend/    API: módulos por funcionalidad, migración única y seeds
frontend/   Interfaz: una carpeta por pantalla
docs/       Documentación por funcionalidad
```

Más detalle: [docs/01-arquitectura.md](docs/01-arquitectura.md).

### Puertos por ambiente

| Servicio | Desarrollo | QA / PRO |
|---|---|---|
| Frontend (web) | 6001 | 7001 |
| API / Swagger | 6002 | 7002 |
| MySQL | 3360 | 3371 (solo `127.0.0.1`) |
| Redis | 3361 | 3372 (solo `127.0.0.1`) |

Son los puertos publicados en el host. Dentro de Docker los servicios siguen en sus puertos internos (API 3000, nginx 80, MySQL 3306, Redis 6379). Como los puertos de cada ambiente son distintos, desarrollo y QA/PRO pueden correr a la vez en una misma máquina.

## Levantamiento

Requisitos: Docker y Docker Compose; para el modo tradicional, además Node.js 22+.

```bash
cp backend/.env.example backend/.env   # completar valores; contraseñas entre comillas simples
```

Único archivo de entorno: `backend/.env`. Los comandos de Docker llevan `--env-file backend/.env` para que Compose tome de ahí `SSH_KEY_PATH` (volumen de la llave SSH).

### Tradicional

```bash
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d mysql redis   # base y redis de desarrollo
cd backend && npm install && npm run migration:run && npm run seed && npm run start:dev
cd frontend && npm install && npm start
```

`backend/.env` con `PORT=6002`, `DB_HOST=localhost`, `DB_PORT=3360`, `REDIS_HOST=localhost`, `REDIS_PORT=3361`. El túnel SSH de PostgreSQL funciona igual: la API lee `SSH_KEY_PATH` directamente.

### Docker

**Desarrollo** (la API se recarga sola al cambiar `backend/src`):

```bash
docker compose --env-file backend/.env -f docker-compose-dev.yml build --no-cache    # crear imágenes
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d               # levantar contenedores
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d --build web   # tras cambiar frontend/
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d --build api   # tras cambiar backend/ fuera de src (package.json, Dockerfile...)
docker compose --env-file backend/.env -f docker-compose-dev.yml logs -f api         # ver logs
docker compose --env-file backend/.env -f docker-compose-dev.yml down                # bajar: borra contenedores y red (conserva datos; -v los BORRA)
docker image rm soporte-carteras-propias-dev-api soporte-carteras-propias-dev-web    # borrar imágenes del ambiente (tras down)
docker compose --env-file backend/.env -f docker-compose-dev.yml down --rmi local    # bajar y borrar sus imágenes de un solo paso (conserva datos)
```

**QA / PRO** (imágenes compiladas; cada servidor con su `backend/.env`):

```bash
docker compose --env-file backend/.env build --no-cache    # crear imágenes
docker compose --env-file backend/.env up -d               # levantar contenedores
docker compose --env-file backend/.env up -d --build       # desplegar versión nueva (frontend y backend)
docker compose --env-file backend/.env up -d --build api   # solo backend/
docker compose --env-file backend/.env up -d --build web   # solo frontend/
docker compose --env-file backend/.env logs -f api         # ver logs
docker compose --env-file backend/.env down                # bajar: borra contenedores y red (conserva datos; -v los BORRA)
docker image rm soporte-carteras-propias-api soporte-carteras-propias-web    # borrar imágenes del ambiente (tras down)
docker compose --env-file backend/.env down --rmi local    # bajar y borrar sus imágenes de un solo paso (conserva datos)
```

**Detener e iniciar sin perder datos**

`stop` apaga los contenedores y los deja creados; `start` los vuelve a encender tal como estaban. Los datos de MySQL no se tocan.

```bash
# Desarrollo
docker compose --env-file backend/.env -f docker-compose-dev.yml stop    # apagar todos los contenedores (quedan creados)
docker compose --env-file backend/.env -f docker-compose-dev.yml start   # encenderlos de nuevo
docker compose --env-file backend/.env -f docker-compose-dev.yml ps -a   # ver el estado de cada contenedor

# QA / PRO
docker compose --env-file backend/.env stop    # apagar todos los contenedores (quedan creados)
docker compose --env-file backend/.env start   # encenderlos de nuevo
docker compose --env-file backend/.env ps -a   # ver el estado de cada contenedor
```

| Comando | Contenedores | Datos de MySQL |
|---|---|---|
| `stop` / `start` | Se apagan / encienden (siguen existiendo) | Se conservan |
| `down` | Se borran (y la red); `up -d` los crea de nuevo | Se conservan |
| `down -v` | Se borran | **Se BORRAN** (elimina el volumen) |

Para apagar un solo servicio se agrega su nombre al final (`stop api`, `start api`). Los contenedores tienen `restart: unless-stopped`: si estaban encendidos, vuelven solos al reiniciar la máquina; si se apagaron con `stop`, siguen apagados hasta hacer `start`.

**Limpieza total de Docker** (todos los contenedores e imágenes de la máquina, **incluidos otros proyectos**):

```bash
docker rm -f $(docker ps -aq)       # borra todos los contenedores (también los que están corriendo)
docker rmi -f $(docker images -q)   # borra todas las imágenes
```

Ninguno borra volúmenes: los datos de MySQL se conservan (solo `down -v` o `docker volume prune` los borran). Tras la limpieza se vuelve a `build` y `up -d`.

Desarrollo y QA/PRO publican puertos distintos ([Puertos por ambiente](#puertos-por-ambiente)): pueden correr a la vez en una misma máquina. Detalle de ambientes, túnel SSH de PostgreSQL y diagnóstico: [docs/13-despliegue-y-operacion.md](docs/13-despliegue-y-operacion.md), [docs/09-configuracion.md](docs/09-configuracion.md).

## Base de datos

Base del sistema: `dbd_soporte_carteras_propias` (desarrollo), `dbq_` (QA) y `dbp_` (PRO), en MySQL 8.0. Esquema en **una sola migración**; datos base (roles, permisos, Super Administrador, menú, novedades, configuración) en el seed. Al arrancar, la API corre ambos. Detalle: [docs/02-base-de-datos.md](docs/02-base-de-datos.md).

### Tradicional

Desde `backend/`:

```bash
npx tsx ./node_modules/typeorm/cli.js -d src/database/data-source.ts migration:show   # ver migraciones aplicadas
npm run migration:run      # correr migraciones
npm run migration:revert   # revertir la última
npm run seed               # correr seeds (solo crea lo que falta)
npm run schema:drop        # BORRA todas las tablas
```

### Docker

Los comandos se ejecutan **dentro del contenedor `api`** (`exec api ...`), que debe estar encendido (`up -d` o `start`). Desarrollo usa los scripts normales (código TypeScript de `src/`); QA/PRO usa los terminados en `:prod` (código compilado de `dist/`).

**Desarrollo**

```bash
# Ver qué migraciones están aplicadas ([X] = aplicada, [ ] = pendiente). Solo consulta, no cambia nada.
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npx tsx ./node_modules/typeorm/cli.js -d src/database/data-source.ts migration:show

# Aplicar las migraciones pendientes (crea las tablas que falten). No borra datos.
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run migration:run

# Deshacer la última migración aplicada. CUIDADO: la migración es única, así que borra todas las tablas y sus datos.
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run migration:revert

# Cargar los datos base (roles, permisos, Super Administrador, menú, novedades, configuración). Solo crea lo que falta.
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run seed

# Reconstruir la base desde cero. BORRA TODOS LOS DATOS.
#   1) schema:drop borra todas las tablas
#   2) restart api reinicia la API, que al arrancar corre la migración y el seed (base limpia con datos base)
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run schema:drop
docker compose --env-file backend/.env -f docker-compose-dev.yml restart api
```

**QA / PRO**

```bash
# Ver qué migraciones están aplicadas ([X] = aplicada, [ ] = pendiente). Solo consulta, no cambia nada.
docker compose --env-file backend/.env exec api node ./node_modules/typeorm/cli.js -d dist/database/data-source.js migration:show

# Aplicar las migraciones pendientes (crea las tablas que falten). No borra datos.
docker compose --env-file backend/.env exec api npm run migration:run:prod

# Deshacer la última migración aplicada. CUIDADO: la migración es única, así que borra todas las tablas y sus datos.
docker compose --env-file backend/.env exec api npm run migration:revert:prod

# Cargar los datos base. Solo crea lo que falta.
docker compose --env-file backend/.env exec api npm run seed:prod

# Reconstruir la base desde cero. BORRA TODOS LOS DATOS (en PRO, sacar respaldo antes).
docker compose --env-file backend/.env exec api npm run schema:drop:prod
docker compose --env-file backend/.env restart api
```

Al reiniciar `api` se corren la migración y el seed sin borrar datos: solo aplican lo que falte. Los datos viven en el volumen de MySQL, así que bajar/levantar contenedores o reconstruir imágenes no los pierde; solo `down -v` o `schema:drop` los borra.

Cada ambiente tiene su propio volumen (desarrollo: `soporte-carteras-propias-dev-mysql-data`; QA/PRO: `soporte-carteras-propias-mysql-data`) y su propio puerto de MySQL (desarrollo `localhost:3360`, QA/PRO `localhost:3371`), así que ambas bases se ven a la vez (`docker volume ls | grep soporte`).

### DBeaver

Nueva conexión → **MySQL**, directa al puerto del ambiente (en QA/PRO desde el propio servidor, porque MySQL solo escucha en `127.0.0.1`):

| Campo | Desarrollo | QA | PRO |
|---|---|---|---|
| Host / Puerto | `localhost` / `3360` | `localhost` / `3371` | `localhost` / `3371` |
| Base de datos | `dbd_soporte_carteras_propias` | `dbq_soporte_carteras_propias` | `dbp_soporte_carteras_propias` |
| Usuario / Contraseña | `DB_USER` / `DB_PASSWORD` de `backend/.env` | igual | igual |
| Driver properties | `allowPublicKeyRetrieval=true`, `useSSL=false` | igual | igual |

## Uso

| | Desarrollo (Docker) | Desarrollo (tradicional) | QA / PRO |
|---|---|---|---|
| **Frontend** | http://localhost:6001 | http://localhost:4200 | http://localhost:7001 |
| **API** | http://localhost:6002/api | http://localhost:6002/api | http://localhost:7002/api |
| **Swagger** | http://localhost:6002/api/docs | http://localhost:6002/api/docs | http://localhost:7002/api/docs |

Primer ingreso con el usuario `SEED_SUPERADMIN_*` del `.env`. Guía por módulo: [docs/](docs/README.md).

## Túnel Cloudflared

Para compartir el sistema por una URL pública temporal (`https://…trycloudflare.com`) sin abrir puertos ni configurar DNS. Solo se tuneliza el **frontend**: nginx reenvía `/api` a la API, así que el backend viaja por el mismo túnel.

```bash
cloudflared tunnel --url http://localhost:6001   # Docker desarrollo
cloudflared tunnel --url http://localhost:7001   # Docker QA / PRO
cloudflared tunnel --url http://localhost:4200   # tradicional (ng serve)
```

- Cloudflared imprime la URL pública; se entra por `https://<generada>.trycloudflare.com/login`.
- Se apunta al origen (`host:puerto`), sin ruta: `/login` se agrega en el navegador.
- La URL cambia cada vez que se levanta y el túnel dura mientras el comando esté corriendo (`Ctrl + C` lo cierra).
- Cualquiera con la URL ve la pantalla de ingreso: cerrar el túnel al terminar.
- Swagger **sí** queda expuesto por el túnel en `/api/docs` (nginx y el proxy de `ng serve` reenvían todo `/api`): cerrar el túnel al terminar.
- No hace falta tocar CORS: la app y `/api` van por el mismo origen. Si se necesita, los orígenes se definen en `CORS_ORIGENES` del `backend/.env` (`*` = cualquiera, o URLs separadas por coma).
- Modo tradicional: `ng serve` solo responde a `localhost` y a `*.trycloudflare.com` (`allowedHosts` en `frontend/angular.json`).

## Licencia

Licencia MIT — © 2026 Ramón Dario Rozo Torres. Ver [LICENSE](LICENSE).

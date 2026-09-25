# Soporte Carteras Propias

Sistema para registrar y resolver casos de soporte de las carteras propias: el equipo registra el caso del cliente, ejecuta la sentencia `UPDATE` que lo corrige contra la base de la cartera y obtiene el mensaje de cierre para el cliente, con control de acceso y trazabilidad.

Documentación detallada por funcionalidad: [`docs/`](docs/README.md).

## ¿Para qué es?

- **Soporte:** registrar el caso (cliente, novedad, mensaje de WhatsApp, motor, sentencia) y ejecutarlo de forma segura: solo `UPDATE` con `WHERE`, en transacción (todo o nada).
- **Informes:** consultar, filtrar y exportar a Excel los casos, con la sentencia y el resultado de cada uno.
- **Administración:** usuarios, roles con jerarquía, permisos por menú y acción, menú, novedades y configuración.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21, PrimeNG 21, Tailwind CSS 4, servido con nginx |
| Backend | NestJS 12, TypeORM, JWT, BullMQ, Swagger (Node 22) |
| Base del sistema | MySQL 8.0 |
| Sesiones y colas | Redis 7 |
| Bases de las carteras | MySQL y PostgreSQL (drivers `mysql2` y `pg`) |
| Infraestructura | Docker y Docker Compose |

## Arquitectura

```
Navegador ──► web (Angular + nginx :3001) ──► api (NestJS :3000/api) ──┬─► mysql (sistema :3307)
                                                                       ├─► redis (sesión y cola :6380)
                                                                       └─► BD de las carteras (MySQL/PostgreSQL, vía VPN)
```

```
backend/    API: módulos por funcionalidad, migración única y seeds
frontend/   Interfaz: una carpeta por pantalla
docs/       Documentación por funcionalidad
```

Más detalle: [docs/01-arquitectura.md](docs/01-arquitectura.md).

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

`backend/.env` con `DB_HOST=localhost`, `DB_PORT=3307`, `REDIS_HOST=localhost`, `REDIS_PORT=6380`. El túnel SSH de PostgreSQL funciona igual: la API lee `SSH_KEY_PATH` directamente.

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
```

Desarrollo y QA/PRO usan los mismos puertos: en una máquina corre uno a la vez. Detalle de ambientes, túnel SSH de PostgreSQL y diagnóstico: [docs/13-despliegue-y-operacion.md](docs/13-despliegue-y-operacion.md), [docs/09-configuracion.md](docs/09-configuracion.md).

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

```bash
# Desarrollo
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npx tsx ./node_modules/typeorm/cli.js -d src/database/data-source.ts migration:show
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run migration:run
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run migration:revert
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run seed
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run schema:drop && docker compose --env-file backend/.env -f docker-compose-dev.yml restart api   # reconstruir (BORRA datos)

# QA / PRO
docker compose --env-file backend/.env exec api node ./node_modules/typeorm/cli.js -d dist/database/data-source.js migration:show
docker compose --env-file backend/.env exec api npm run migration:run:prod
docker compose --env-file backend/.env exec api npm run migration:revert:prod
docker compose --env-file backend/.env exec api npm run seed:prod
docker compose --env-file backend/.env exec api npm run schema:drop:prod && docker compose --env-file backend/.env restart api   # reconstruir (BORRA datos)
```

Al reiniciar `api` se corren la migración y el seed sin borrar datos: solo aplican lo que falte. Los datos viven en el volumen de MySQL, así que bajar/levantar contenedores o reconstruir imágenes no los pierde; solo `down -v` o `schema:drop` los borra.

Cada ambiente tiene su propio volumen (desarrollo: `soporte-carteras-propias-dev-mysql-data`; QA/PRO: `soporte-carteras-propias-mysql-data`) y ambos usan `localhost:3307`: DBeaver solo ve la base del ambiente levantado. La otra no se pierde; reaparece al levantar su ambiente (`docker volume ls | grep soporte`).

### DBeaver

Nueva conexión → **MySQL**, directa a `localhost:3307` en todos los ambientes (corre uno a la vez); cambia solo la base:

| Campo | Desarrollo | QA | PRO |
|---|---|---|---|
| Host / Puerto | `localhost` / `3307` | `localhost` / `3307` | `localhost` / `3307` |
| Base de datos | `dbd_soporte_carteras_propias` | `dbq_soporte_carteras_propias` | `dbp_soporte_carteras_propias` |
| Usuario / Contraseña | `DB_USER` / `DB_PASSWORD` de `backend/.env` | igual | igual |
| Driver properties | `allowPublicKeyRetrieval=true`, `useSSL=false` | igual | igual |

## Uso

| | Desarrollo (Docker) | Desarrollo (tradicional) | QA / PRO |
|---|---|---|---|
| **Frontend** | http://localhost:3001 | http://localhost:4200 | `http://<servidor>:3001` |
| **API** | http://localhost:3000/api | http://localhost:3000/api | `http://<servidor>:3000/api` |
| **Swagger** | http://localhost:3000/api/docs | http://localhost:3000/api/docs | `http://<servidor>:3000/api/docs` |

Primer ingreso con el usuario `SEED_SUPERADMIN_*` del `.env`. Guía por módulo: [docs/](docs/README.md).

## Túnel Cloudflared

Para compartir el sistema por una URL pública temporal (`https://…trycloudflare.com`) sin abrir puertos ni configurar DNS. Solo se tuneliza el **frontend**: nginx reenvía `/api` a la API, así que el backend viaja por el mismo túnel.

```bash
cloudflared tunnel --url http://localhost:3001   # Docker (dev, QA o PRO)
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

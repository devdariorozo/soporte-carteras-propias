# 02 · Base de datos

MySQL 8.0, una base por ambiente, cada una en su propio volumen Docker:

| Ambiente | Base (`DB_NAME`) | Volumen |
|---|---|---|
| Desarrollo | `dbd_soporte_carteras_propias` | `soporte-carteras-propias-dev-mysql-data` |
| QA | `dbq_soporte_carteras_propias` | `soporte-carteras-propias-mysql-data` (servidor QA) |
| PRO | `dbp_soporte_carteras_propias` | `soporte-carteras-propias-mysql-data` (servidor PRO) |

El contenedor `mysql` crea la base al iniciar por primera vez un volumen vacío (`MYSQL_DATABASE` = `DB_NAME`, `MYSQL_ROOT_PASSWORD` = `DB_PASSWORD`). Las tablas las crea la migración y los datos base el seed.

Conexión de la API: `backend/src/database/data-source.ts`.

| Opción | Valor |
|---|---|
| `host` / `port` / `username` / `password` / `database` / `poolSize` | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_POOL_SIZE` |
| `timezone` | `'Z'`: los `TIMESTAMP` se leen como UTC, corra la API en Docker o en el host |
| `synchronize` | `false`: el esquema solo lo cambia la migración |
| `namingStrategy` | `SnakeNamingStrategy` (propiedades camelCase ↔ columnas snake_case) |

## Columnas de auditoría (todas las tablas)

`AuditableBaseEntity` (`backend/src/common/entities/auditable.base-entity.ts`) y la constante `AUDIT_COLUMNS` de la migración:

| Columna | Tipo | Uso |
|---|---|---|
| `id` | `INT AUTO_INCREMENT PK` | Identificador |
| `estado_registro` | `TINYINT(1) NOT NULL DEFAULT 1` | 1 = activo, 0 = inactivo |
| `descripcion` | `VARCHAR(255) NULL` | Nota libre. En `soporte` guarda el mensaje del resultado de la ejecución |
| `id_usuario` | `INT NULL` | Último responsable del cambio (sin llave foránea) |
| `fecha_creacion` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | Alta |
| `fecha_actualizacion` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Último cambio |
| `fecha_eliminacion` | `TIMESTAMP NULL` | Borrado lógico |

**Eliminar** = `estado_registro = 0` + `fecha_eliminacion` (`softDelete`). Las consultas de TypeORM excluyen solas las filas con `fecha_eliminacion`. Informes las incluye a propósito (`withDeleted`).

**Duplicados y eliminados:** un registro eliminado **no cuenta** como duplicado; uno vigente (sin `fecha_eliminacion`), activo o inactivo, **sí**. Así lo validan los servicios (409) y así lo exige la base:

- MySQL no tiene índices únicos parciales. Cada UNIQUE va sobre una **columna virtual** `<columna>_vigente` = `IF(fecha_eliminacion IS NULL, <columna>, NULL)` (función `unicoSinEliminados` de la migración). Al eliminar, la columna pasa a NULL y deja libre el valor (UNIQUE admite varios NULL).
- Aplica a `menu` (`menu`, `ruta`, `orden`) y `usuarios` (`usuario`, `correo`). Roles, novedades y permisos no tienen UNIQUE en BD: solo la validación del servicio, con la misma regla.
- Las columnas `_vigente` no están en las entidades de TypeORM: no se leen ni se escriben, solo sostienen el índice.
- Restaurar a mano (`fecha_eliminacion = NULL`) un registro cuyo valor ya usa otro vigente falla por el índice.

## Tablas

Migración única: `backend/src/database/migrations/1700000000000-initial-schema.ts`. Todas con `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.

### `roles`

| Columna | Tipo | Nota |
|---|---|---|
| `rol` | `VARCHAR(45) NOT NULL` | Nombre. El **id** define la jerarquía (1 = mayor) |

### `menu`

| Columna | Tipo | Nota |
|---|---|---|
| `apartado` | `VARCHAR(45) NOT NULL` | Grupo de la barra lateral (Administración, Control, Operación) |
| `menu` | `VARCHAR(45) NOT NULL` | Nombre. **UNIQUE** `uq_menu_menu` (entre no eliminadas). Es la llave lógica de `permisos.menu` |
| `ruta` | `VARCHAR(150) NOT NULL` | **UNIQUE** `uq_menu_ruta` (entre no eliminadas) |
| `icono` | `VARCHAR(45) NOT NULL` | Clase PrimeIcons (ej. `pi pi-cog`) |
| `orden` | `INT NOT NULL` | **UNIQUE** `uq_menu_orden` (entre no eliminadas) |

### `permisos`

| Columna | Tipo | Nota |
|---|---|---|
| `id_rol` | `INT NOT NULL` | FK `fk_permisos_rol` → `roles.id` **ON DELETE CASCADE** |
| `menu` | `VARCHAR(45) NOT NULL` | Debe ser igual a un `menu.menu` activo. Lo valida `PermisosService`, sin FK |
| `permiso` | `VARCHAR(45) NOT NULL` | `Crear`, `Editar`, `Eliminar`, `Consultar`, `Opciones` |

### `usuarios`

| Columna | Tipo | Nota |
|---|---|---|
| `numero_documento` | `VARCHAR(21) NOT NULL` | Con puntos de miles (ej. `1.234.567`) |
| `primer_nombre`, `primer_apellido` | `VARCHAR(60) NOT NULL` | |
| `segundo_nombre`, `segundo_apellido` | `VARCHAR(60) NULL` | |
| `numero_contacto` | `VARCHAR(20) NOT NULL` | Formato `321 256 5689` |
| `id_rol` | `INT NOT NULL` | FK `fk_usuarios_rol` → `roles.id` **ON DELETE RESTRICT** |
| `correo` | `VARCHAR(120) NOT NULL` | **UNIQUE** `uq_usuarios_correo` (entre no eliminados) |
| `usuario` | `VARCHAR(45) NOT NULL` | Login. **UNIQUE** `uq_usuarios_usuario` (entre no eliminados) |
| `password` | `VARCHAR(255) NOT NULL` | Hash bcrypt |
| `secreto` | `VARCHAR(255) NULL` | Secreto de recuperación, hash bcrypt. `NULL` hasta el primer cambio de contraseña o tras un restablecimiento asistido |
| `debe_cambiar_password` | `TINYINT(1) NOT NULL DEFAULT 1` | Obliga a cambiar la contraseña al entrar |
| `refresh_token` | `VARCHAR(255) NULL` | Guarda el `sid` de la sesión vigente, no el token (ver [03](03-autenticacion-y-sesion.md)) |
| `ultimo_tipo_equipo`, `ultimo_navegador`, `ultimo_sistema_operativo` | `VARCHAR(20/100/100) NULL` | Del último login |
| `ultima_fecha_login` | `DATETIME NULL` | |

### `novedades`

| Columna | Tipo | Nota |
|---|---|---|
| `novedad` | `VARCHAR(45) NOT NULL` | Tipo de caso. Sin UNIQUE en BD: el servicio evita duplicados por nombre |

### `soporte`

| Columna | Tipo | Nota |
|---|---|---|
| `cliente` | `VARCHAR(100) NOT NULL` | Capitalizado |
| `id_novedad` | `INT NOT NULL` | FK `fk_soporte_novedad` → `novedades.id` **ON DELETE RESTRICT** |
| `mensaje_whatsapp` | `VARCHAR(255) NOT NULL` | Mensaje original del caso |
| `motor` | `ENUM('mysql','postgres') NOT NULL` | Igual al `configuracion.nombre` de la conexión que se usa al ejecutar |
| `sentencia` | `TEXT NOT NULL` | Uno o varios `UPDATE` con `WHERE`, o uno o varios `INSERT` limpios (sin mezclar) |
| `estado_soporte` | `ENUM('Creado','En proceso','Completado','Error') NOT NULL DEFAULT 'Creado'` | No existe `Cancelado` |

### `configuracion`

| Columna | Tipo | Nota |
|---|---|---|
| `nombre` | `VARCHAR(45) NOT NULL` | Sin UNIQUE: hay varias versiones por nombre y solo una activa. Crear una versión desactiva la anterior |
| `alcance` | `VARCHAR(45) NOT NULL` | A qué bases aplica la conexión (seed: `mysql` → `Todas`, `postgres` → `Base Raiz`). 3 a 45 caracteres. Texto del select Motor de Soporte |
| `objeto` | `JSON NOT NULL` | JSON plano, un valor por clave (texto, número, sí/no o lista), sin cifrar |

### `migrations`

La crea TypeORM para registrar las migraciones corridas.

### Relaciones

```
roles 1 ──< permisos     (CASCADE)
roles 1 ──< usuarios     (RESTRICT)
novedades 1 ──< soporte  (RESTRICT)
menu.menu ··· permisos.menu      (lógica, validada en servicio)
configuracion.nombre ··· soporte.motor   (lógica)
usuarios.id ··· <tabla>.id_usuario       (lógica, auditoría)
```

## Regla: migración única

Mientras el proyecto está en desarrollo inicial, **todo el esquema vive en un solo archivo**: `backend/src/database/migrations/1700000000000-initial-schema.ts` (registrado en `data-source.ts`).

- Un cambio de esquema se hace **editando ese archivo** (y la entidad correspondiente) y **reconstruyendo la base**.
- No se crean migraciones nuevas (`migration:generate` no se usa) ni se hace `ALTER` a mano.
- `down()` borra las 7 tablas en orden inverso.

## Seed (`backend/src/database/seeds/run-seed.ts`)

Corre en cada arranque del contenedor `api` (después de la migración). Crea solo lo que falta y **nunca borra**. La única actualización es agregar a la configuración activa las claves de ejemplo que le falten.

| Paso | Qué crea | Clave de idempotencia |
|---|---|---|
| Roles | 4: Super Administrador (id 1), Administrador (2), Desarrollador(a) (3), Aprendiz Sena (4) | `rol` |
| Permisos | 71 filas: Super Administrador 32, Administrador 28 (todo menos Configuración), Desarrollador(a) 9, Aprendiz Sena 2 (ver [05-permisos](05-permisos.md)) | `id_rol` + `menu` + `permiso` |
| Super Administrador | Desde `SEED_SUPERADMIN_*`: `usuario` = documento sin formato, documento con puntos, teléfono `3-3-4`, contraseña bcrypt, `debe_cambiar_password = 1` | `usuario` |
| Configuraciones | `mysql` y `postgres` con datos **ficticios** (placeholders). `postgres` trae, en el orden de DBeaver, Main (`host`, `database`, `username`, `password`, `port`), `ssl: true` y SSH (`ssh_host`, `ssh_username`, `ssh_passphrase`, `ssh_port`). No hay fila `cors`: CORS va en `CORS_ORIGENES` del `.env`. Si la fila activa ya existe, el seed solo le **agrega las claves que le falten** con su valor de ejemplo (nunca cambia un valor escrito) | `nombre` |
| Menú | 8 opciones: Configuración, Roles, Menu, Permisos, Usuarios, Novedades (Administración), Informe (Control), Soporte (Operación) | `ruta` |
| Novedades | 21 tipos de caso (ej. Romper Acuerdo, Subir Novación, Caída De Soul...) | `novedad`, incluidas las eliminadas |

Reglas:
- Obligatorias: `SEED_SUPERADMIN_DOCUMENTO`, `_NOMBRE`, `_APELLIDO`, `_NUMERO_CONTACTO`, `_CORREO`, `_PASSWORD`. Si falta una, el seed falla y, en Docker, la API no arranca (`set -e` en el entrypoint). `_SEGUNDO_NOMBRE` y `_SEGUNDO_APELLIDO` son opcionales.
- Los registros sembrados llevan `descripcion = 'Creado en la migración inicial.'` e `id_usuario = 1`, salvo el Super Administrador (`id_usuario = NULL`).
- Cambiar `SEED_SUPERADMIN_*` en el `.env` no modifica un Super Administrador ya creado. Solo aplica al reconstruir la base.
- Salvo en novedades, la búsqueda excluye filas eliminadas. Si alguien elimina desde la app un rol, permiso, configuración, opción de menú o el Super Administrador sembrados, el seed los crea otra vez en el siguiente arranque (el eliminado no ocupa su nombre, ruta o usuario; ver *Duplicados y eliminados*).

## Comandos

Scripts de `backend/package.json`. En Docker, desarrollo usa los scripts con `tsx` (fuentes) y QA/PRO las versiones `:prod` (compilado en `dist/`).

| Acción | Tradicional (`cd backend`) | Docker desarrollo | Docker QA / PRO |
|---|---|---|---|
| Correr migración | `npm run migration:run` | `docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run migration:run` | `docker compose --env-file backend/.env exec api npm run migration:run:prod` |
| Revertir migración | `npm run migration:revert` | `... exec api npm run migration:revert` | `... exec api npm run migration:revert:prod` |
| Correr seed | `npm run seed` | `... exec api npm run seed` | `... exec api npm run seed:prod` |
| Borrar todas las tablas | `npm run schema:drop` | `... exec api npm run schema:drop` | `... exec api npm run schema:drop:prod` |
| Consola MySQL | `mysql -h 127.0.0.1 -P 3360 -uroot -p` | `docker compose --env-file backend/.env -f docker-compose-dev.yml exec mysql sh -c 'mysql -uroot -p"$DB_PASSWORD" "$DB_NAME"'` | `docker compose --env-file backend/.env exec mysql sh -c 'mysql -uroot -p"$DB_PASSWORD" "$DB_NAME"'` |

Tradicional = MySQL y Redis en Docker, API con `npm` en el host (`DB_HOST=localhost`, `DB_PORT=3360`).

## Reconstruir la base

**Borra todos los datos.** El Super Administrador vuelve a los valores de `SEED_SUPERADMIN_*` (y debe cambiar la contraseña otra vez).

```bash
# Docker desarrollo: borrar tablas y reiniciar (al arrancar corre migración + seed)
docker compose --env-file backend/.env -f docker-compose-dev.yml exec api npm run schema:drop
docker compose --env-file backend/.env -f docker-compose-dev.yml restart api

# Docker QA / PRO (con extremo cuidado: respaldar antes, ver 13)
docker compose --env-file backend/.env exec api npm run schema:drop:prod
docker compose --env-file backend/.env restart api

# Tradicional
cd backend && npm run schema:drop && npm run migration:run && npm run seed
```

Otra forma, desde cero: `down -v` borra también el volumen de MySQL. En el siguiente `up` se crea la base vacía y el entrypoint corre migración y seed.

```bash
docker compose --env-file backend/.env -f docker-compose-dev.yml down -v
docker compose --env-file backend/.env -f docker-compose-dev.yml up -d
```

## Caracteres

- Tablas: `utf8mb4` / `utf8mb4_unicode_ci` (fijado en `TABLE_OPTIONS` de la migración).
- Conexión: `utf8mb4`. `data-source.ts` no fija `charset`, así que aplica el valor por defecto del driver `mysql2` (`UTF8MB4_UNICODE_CI`).
- Tildes y emojis (✅ 🤝, usados en el mensaje de éxito de Soporte) se guardan correctamente.
- La collation no distingue mayúsculas: las búsquedas `LIKE` (ej. autocompletado de clientes) tampoco.

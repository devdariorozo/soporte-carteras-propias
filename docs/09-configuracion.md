# 09 · Configuración

Parámetros del sistema guardados en la tabla `configuracion`: las conexiones de Soporte (`mysql`, `postgres`) y el límite de ejecuciones (`rate_limit`). **Exclusiva del Super Administrador** (y del sistema internamente).

## Quién accede

- Solo el Super Administrador tiene permisos sobre el menú Configuración en el seed; el Administrador no.
- Los permisos de Configuración solo los puede ver, crear o quitar el Super Administrador (ver [05-permisos](05-permisos.md)), así que ningún otro rol puede llegar a tenerlos.
- La opción de menú Configuración solo la edita o elimina el Super Administrador (ver [07-menu](07-menu.md)).

## Modelo

| Campo | Regla |
|---|---|
| Nombre | Obligatorio, máx. 45. Identifica la configuración (`mysql`, `postgres`, `rate_limit`, …) |
| Alcance | Obligatorio, 3–45. A qué bases aplica la conexión (ej. `Todas`, `Base Raiz`); se muestra en el select Motor de Soporte |
| Objeto | JSON plano de pares clave/valor. Cada valor: texto, número, sí/no o lista de textos/números. Claves no vacías y sin repetir |
| Estado | Activo (1) / Inactivo (0). El sistema usa **la fila activa** del nombre |
| Descripción | Opcional, 3–255 |

**Versionado:** crear (`POST`) una fila con un nombre que ya tiene una activa **desactiva la anterior** y deja activa la nueva. Así queda el histórico de valores. La comparación del nombre no distingue mayúsculas (collation de la base).

- **Editar (`PATCH`) no versiona:** modifica la misma fila. Reactivar a mano una versión vieja deja dos activas del mismo nombre; evitarlo (crear una nueva en su lugar).
- Eliminar es lógico (soft delete). Sin fila activa, el sistema actúa como si no existiera (Soporte falla con "No hay una conexión activa configurada…"; `rate_limit` deja de limitar).
- El `objeto` se guarda **sin cifrar** y la API lo devuelve completo (incluidas contraseñas) a quien tenga Consultar.

## Formulario: todo es texto

En la pantalla, el objeto se edita como filas **Clave / Valor** (botón Agregar, papelera para quitar). Todo valor se escribe como texto; no hay que elegir tipos. Una lista existente se muestra como `a, b` y, si se guarda desde el formulario, queda como texto.

Al guardar, el backend convierte cada clave conocida a su tipo (`backend/src/modules/configuracion/normalizar-objeto.util.ts`), según el nombre de la configuración (sin distinguir mayúsculas ni espacios alrededor):

| Tipo | Conversión | Si no se puede convertir |
|---|---|---|
| texto | `String(valor)` sin espacios alrededor. `password` y `ssh_passphrase` se guardan tal cual (pueden tener espacios a propósito) | — |
| numero | `"3306"` → `3306` | Se deja como llegó y la validación lo rechaza |
| booleano | `true`, `si`, `sí`, `1` → `true`; `false`, `no`, `0` → `false` (sin distinguir mayúsculas) | Se deja como llegó y la validación lo rechaza |

| Configuración | Claves convertidas |
|---|---|
| `mysql` | `host`, `username`, `password` (texto); `port` (numero) |
| `postgres` | `host`, `database`, `username`, `password`, `ssh_host`, `ssh_username`, `ssh_passphrase` (texto); `port`, `ssh_port` (numero); `ssl` (booleano) |
| `rate_limit` | `requests_por_minuto` (numero) |

Claves no listadas, y configuraciones con otro nombre, se guardan como llegan.

## Configuraciones del sistema

| Nombre | Claves | Uso |
|---|---|---|
| `mysql` | `host`, `port`, `username`, `password` | Conexión de Soporte con motor MySQL |
| `postgres` | Main: `host`, `database`, `username`, `password`, `port`; `ssl` (opcional); SSH (opcional): `ssh_host`, `ssh_username`, `ssh_passphrase`, `ssh_port` | Conexión de Soporte con motor PostgreSQL (directa o por túnel SSH) |
| `rate_limit` (opcional) | `requests_por_minuto` | Límite global de ejecuciones de Soporte |

- El seed crea `mysql` (valores locales de desarrollo) y `postgres` (valores **ficticios**); `rate_limit` no se siembra. El seed solo crea cada nombre la primera vez.
- El nombre de la conexión es el valor del campo **Motor** de Soporte: `mysql` o `postgres`, en minúscula.

> **CORS no es una configuración de BD.** Los orígenes permitidos van en `CORS_ORIGENES` de `backend/.env` (`*` o URLs separadas por coma). Ver [13-despliegue-y-operacion](13-despliegue-y-operacion.md#cors).

## Validación de conexiones

`backend/src/modules/configuracion/conexion-bd.util.ts` valida el objeto de `mysql` y `postgres` **al crear, al editar y otra vez antes de cada ejecución** de Soporte. Si falla, se rechaza con 400 y todos los motivos: `La conexión "mysql" no es válida: "host" está vacío; falta "port".`

| Clave | Obligatoria | Regla |
|---|---|---|
| `host` | Sí | Texto no vacío (IP o nombre). Nunca número: una IP guardada como número apunta a otra dirección |
| `port` | Sí | Entero 1–65535 |
| `username` | Sí | Texto no vacío |
| `password` | Sí | Texto; puede ir vacío |
| `database` | Sí en `postgres` (en `mysql` se ignora) | Texto no vacío |
| `ssl` | No, solo `postgres` | `true` / `false` |
| `ssh_host` | No, solo `postgres` | Texto no vacío. Si está, se usa túnel |
| `ssh_port` | No, solo `postgres` | Entero 1–65535 (22 si falta) |
| `ssh_username` | Con `ssh_host` | Texto no vacío |
| `ssh_passphrase` | No, solo `postgres` | Texto; puede ir vacío |

- **Base de datos:** en `mysql` no va aquí (la trae cada sentencia, `base.tabla`); en `postgres` es **obligatoria** (`database`), porque las sentencias vienen como `esquema.tabla` (ver [10-soporte](10-soporte.md#reglas-de-la-sentencia)).
- `ssl` y `ssh_*` en `mysql` se rechazan ("solo aplican a \"postgres\""): el driver de MySQL no los usa.
- Una clave opcional presente pero vacía se rechaza: si no se usa, se quita la fila.
- `localhost`, `127.0.0.1` y `::1` en `host` (y en `ssh_host`) se traducen, en Docker, a la máquina anfitriona (`HOST_LOCAL_ALIAS=host.docker.internal`, definido en los Compose). En modo tradicional se usan tal cual.

## Rate limit

- Con fila activa `rate_limit` y `requests_por_minuto` > 0, cada `POST /api/soporte/:id/ejecutar` suma 1 a un contador global en Redis por minuto de reloj (`rate_limit:ejecutar-soporte:<minuto>`, expira a los 60 s).
- Si el contador supera el límite: **429** "Se alcanzó el límite de ejecuciones por minuto, intenta de nuevo en unos segundos.".
- Es global (todos los usuarios juntos). Sin la fila, con `0` o con un valor no numérico, no hay límite.
- En pantalla, Soporte muestra el 429 como aviso amarillo. El límite de intentos de login no está aquí sino en `backend/.env` ([03](03-autenticacion-y-sesion.md#límite-de-intentos-login-y-recuperar-contraseña)); ambos se resumen en [14-api](14-api.md#429-límite-excedido).

## PostgreSQL por túnel SSH (bastión)

Para bases que solo se alcanzan a través de un bastión (ej. AWS RDS / Aurora), la API abre un túnel SSH en cada ejecución, se conecta a la base a través de él y cierra ambos al terminar. Equivale a la pestaña **SSH** de DBeaver.

### Claves de la configuración `postgres`

En el mismo orden que DBeaver (el sistema siempre las muestra así):

| DBeaver | Clave | Obligatoria | Ejemplo (ficticio) | Descripción |
|---|---|---|---|---|
| Main → Host | `host` | Sí | `mi-base.xxxxxxxx.us-east-1.rds.amazonaws.com` | Host de la base **visto desde el bastión** |
| Main → Database | `database` | Sí | `mi_base_cartera` | Base de datos. Las sentencias se escriben `esquema.tabla` |
| Main → Username | `username` | Sí | `usuario_cartera` | Usuario de la base |
| Main → Password | `password` | Sí | `CAMBIAR_PASSWORD` | Contraseña de la base |
| Main → Port | `port` | Sí | `5432` | Puerto de la base |
| SSL | `ssl` | No | `true` | Conexión cifrada. Necesaria si el servidor solo acepta SSL (`pg_hba.conf` con `hostssl`); sin ella falla con "rechazó la conexión… (puede exigir conexión cifrada)". No verifica el certificado. El seed la trae en `true` |
| SSH → Host/IP | `ssh_host` | No | `203.0.113.10` | IP del bastión. **Si está, se usa túnel**; si no, conexión directa |
| SSH → User Name | `ssh_username` | Con `ssh_host` | `usuario_bastion` | Usuario del bastión |
| SSH → Private Key | — | Con `ssh_host` | — | **No va aquí:** es `SSH_KEY_PATH` de `backend/.env` (ver abajo) |
| SSH → Passphrase | `ssh_passphrase` | No | `CAMBIAR_PASSPHRASE` | Frase de la llave, si tiene |
| SSH → Port | `ssh_port` | No | `22` | Puerto SSH (22 por defecto) |

- La base de datos **sí** va en la configuración (`database`); la sentencia trae `esquema.tabla`.
- El seed crea `postgres` con estos valores ficticios; los reales se escriben en Configuración. Si la fila ya existía, el seed le agrega las claves que falten (ej. `database`, `ssl`, `ssh_*`) al final del objeto con el valor de ejemplo, sin tocar las demás: reemplázalas por las reales.
- **La llave privada no va en Configuración:** su ruta es `SSH_KEY_PATH` de `backend/.env` (ver abajo).
- Sin túnel, `localhost` se traduce a la máquina anfitriona; con túnel, `host` se usa tal cual (lo resuelve el bastión).
- Por el túnel el driver se conecta a `127.0.0.1:<puerto local efímero>`; con `ssl: true` conserva el nombre real del host para el handshake TLS.
- Tiempo máximo para conectar al bastión y a la base: 10 s cada uno.

### La llave privada: `SSH_KEY_PATH`

La ruta de la llave va **solo** en `backend/.env` y sirve igual en tradicional y en Docker. La llave no se copia al proyecto ni entra en la imagen.

1. **Formato OpenSSH**, no `.ppk` (el `.ppk` es para PuTTY/DBeaver). Si la primera línea es `-----BEGIN OPENSSH PRIVATE KEY-----` está lista; si solo tienes el `.ppk`:
   ```bash
   puttygen llave.ppk -O private-openssh -o llave
   ```
2. **Permisos:** `chmod 600 /ruta/a/la/llave`.
3. **Ruta real en `backend/.env`:**
   ```
   SSH_KEY_PATH=/home/usuario/accesos/llave_bastion
   ```
4. **Reiniciar la API** según el modo:

| Modo | Cómo toma la llave | Tras cambiar `SSH_KEY_PATH` |
|---|---|---|
| **Tradicional** | La API corre en la máquina y lee la ruta directamente | Reiniciar `npm run start:dev` |
| **Docker** | Compose monta el archivo en el contenedor (`/run/secrets/bastion_key`, solo lectura) y le pasa esa ruta a la API | `docker compose --env-file backend/.env -f docker-compose-dev.yml up -d api` (QA/PRO: `docker compose --env-file backend/.env up -d api`) |

```
Docker:  SSH_KEY_PATH (ruta real en la máquina) ── volumen :ro ──► /run/secrets/bastion_key (dentro de api)
```

**Si la llave cambia de lugar:** se cambia solo `SSH_KEY_PATH` y se repite el paso 4. Ni la imagen ni Configuración cambian.

**Por qué `--env-file backend/.env` en Docker:** Compose arma los volúmenes con variables de su archivo de entorno, y el único del proyecto es `backend/.env`. Sin él (o sin `SSH_KEY_PATH`) el volumen monta `/dev/null` y Soporte avisa "La llave SSH está vacía".

### Requisitos de red

- El bastión debe permitir la IP pública del servidor donde corre `api` (igual que la de tu equipo para DBeaver).
- El bastión debe permitir reenvío TCP (`AllowTcpForwarding yes`), lo normal en un bastión.

### Errores frecuentes

En Soporte los mensajes **nunca** muestran datos de la conexión (host, usuario, contraseña, base, bastión): el error completo del driver queda solo en el log de `api`.

| Mensaje en Soporte | Causa |
|---|---|
| Falta SSH_KEY_PATH en backend/.env | La variable no está definida (tradicional) |
| No se pudo leer la llave SSH | Ruta de `SSH_KEY_PATH` incorrecta o sin permiso de lectura (tradicional) |
| La llave SSH está vacía | Docker: comando sin `--env-file backend/.env`, o no se recreó `api` tras definir `SSH_KEY_PATH` |
| …bastión SSH…: el bastión rechazó la autenticación | Usuario, llave o passphrase incorrectos |
| …bastión SSH…: Cannot parse privateKey… bad passphrase? | `ssh_passphrase` incorrecta, o la llave es `.ppk` |
| …bastión SSH…: tiempo de espera agotado | IP/puerto del bastión, o la IP del servidor no está permitida |
| The server does not support SSL connections | `ssl: true` contra una base sin SSL: poner `false` |
| El servidor PostgreSQL rechazó la conexión desde este servidor (puede exigir conexión cifrada) | `no pg_hba.conf entry … no encryption` en el log: la base exige SSL, poner `ssl: true` |
| La conexión "postgres" en Configuración está incompleta o mal escrita | La fila activa no pasa la validación (ver arriba); el detalle sale al guardarla en Configuración |

## Endpoints (`/api/configuracion`)

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/` | Configuración → Consultar | Listado paginado (`page`, `limit`), más recientes primero, con Responsable |
| GET | `/:id` | Configuración → Consultar | Una fila |
| POST | `/` | Configuración → Crear | Nueva versión (desactiva la activa del mismo nombre) |
| PATCH | `/:id` | Configuración → Editar | Nombre, alcance, objeto (reemplaza el objeto completo), descripción y/o estado |
| DELETE | `/:id` | Configuración → Eliminar | Soft delete |

## Código

| Qué | Dónde |
|---|---|
| Servicio (versionado, `obtenerActivaPorNombre`) | `backend/src/modules/configuracion/configuracion.service.ts` |
| Conversión por tipo | `backend/src/modules/configuracion/normalizar-objeto.util.ts`, `objeto-valor.util.ts` |
| Validación de conexiones | `backend/src/modules/configuracion/conexion-bd.util.ts` |
| Formato del objeto (DTO) | `backend/src/modules/configuracion/dto/objeto-configuracion.validator.ts` |
| Túnel SSH | `backend/src/common/raw-db/tunel-ssh.ts` |
| Rate limit | `backend/src/modules/soporte/soporte.service.ts` (`verificarRateLimit`) |
| Seed (`CONFIGURACIONES_SEED`) | `backend/src/database/seeds/run-seed.ts` |
| Pantalla | `frontend/src/app/features/configuracion/` |

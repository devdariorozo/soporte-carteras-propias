# 10 · Soporte

Registra un caso reportado por WhatsApp y ejecuta su sentencia `UPDATE` contra el servidor de la cartera (MySQL o PostgreSQL). Cada caso queda en la tabla `soporte` con su estado y el mensaje de resultado, y se consulta en [11-informes](11-informes.md).

## Acceso

| Acción | Permiso |
|---|---|
| Ver el formulario y registrar | Soporte → Crear |
| Ejecutar y reintentar (`/ejecutar`, `PATCH`) | Soporte → Editar |
| Autocompletado de clientes | Soporte → Crear |
| Select de novedades | Novedades → Opciones |

El rol Desarrollador(a) tiene Crear, Editar y Consultar sobre Soporte (no Eliminar). La pantalla no tiene listado: los casos se consultan en Informes.

## Formulario

| Campo | Regla | Al guardar |
|---|---|---|
| Cliente | Obligatorio, máx. 100. Autocompletado de clientes ya registrados; se puede escribir uno nuevo | Mayúscula inicial por palabra, resto en minúscula, espacios repetidos colapsados (`PEPE  pérez` → `Pepe Pérez`) |
| Novedad | Obligatoria, select con buscador (catálogo activo, ver [08-novedades](08-novedades.md)) | `id_novedad` |
| Mensaje de WhatsApp | Obligatorio, 3–255 | Tal cual |
| Motor | Conexiones activas de Configuración (`GET /api/soporte/motores`): valor = `nombre` (`mysql` / `postgres`), texto = motor y alcance (ej. `MySQL - Todas`, `PostgreSQL - Base Raiz`). Define qué conexión se usa | Tal cual |
| Sentencia | Obligatoria, 3–5000; reglas abajo | Tal cual |

### Autocompletado de cliente

- Tras escribir **2 letras** (espera de 300 ms) llama a `GET /api/soporte/clientes?q=<texto>`.
- Devuelve clientes **distintos** ya registrados (activos, no eliminados) que **contienen** el texto, sin distinguir mayúsculas, en orden alfabético, **máximo 10**.
- Sirve para reutilizar la misma escritura (evita "Leidy" / "Leydi"). No obliga: se permite un cliente nuevo.
- Mientras se escribe, el campo ya se muestra capitalizado, igual a como lo guarda el backend.

## Reglas de la sentencia

Rígidas en backend (`backend/src/common/sql/sentencia-update.util.ts`); el formulario aplica la misma regla mientras se escribe (`frontend/src/app/core/utils/sentencia.util.ts`) y muestra la advertencia **amarilla** antes de enviar. Sin motor elegido solo valida UPDATE/WHERE; al elegirlo, también la forma de la tabla.

1. **Solo `UPDATE`.** SELECT, INSERT, DELETE, DROP, WITH, etc. se rechazan (`es un DELETE; ajústala a un UPDATE.`).
2. **Uno o varios UPDATE** separados por `;`. El `;` dentro de textos (`'…'`, `"…"`, `` `…` ``) o comentarios (`--`, `#`, `/* */`) no separa. Se admiten comentarios (ej. scripts de DBeaver); fragmentos con solo comentarios se descartan.
3. **Cada UPDATE con `WHERE`** en su nivel principal: no vale uno dentro de un texto, un comentario o una subconsulta `( … )`.
4. **Forma de la tabla del UPDATE** según el motor (en MySQL se admiten `LOW_PRIORITY`, `IGNORE` y nombres entre `` ` ``; en PostgreSQL, `ONLY` y nombres entre `"`):

   | Motor | Forma | Base de datos | Ejemplo |
   |---|---|---|---|
   | MySQL | `base.tabla` | La trae la sentencia | `UPDATE mi_base.promesas SET estado = 'pagada' WHERE id = 123;` |
   | PostgreSQL | `esquema.tabla` (como la genera DBeaver) | `database` de la configuración `postgres` | `UPDATE public.promesas SET estado = 'pagada' WHERE id = 123;` |

   En PostgreSQL también se acepta `base.esquema.tabla`, pero esa base debe ser la misma de la configuración; si no, falla con "La sentencia es de otra base de datos". Solo `tabla`, sin esquema, se rechaza.

   Scripts con comentarios, casts (`'{…}'::jsonb`) y JSON dentro de textos se aceptan tal cual:
   ```sql
   -- Auto-generated SQL script
   UPDATE mi_esquema.clientes
       SET otra_informacion = '{"edad": 20, "correo": "cliente@example.com"}'::jsonb
       WHERE id = 5;
   ```

5. **PostgreSQL: una sola base** (una conexión es de una sola base): las sentencias que indiquen base deben coincidir entre sí y con la configuración. En MySQL pueden ser bases distintas del mismo servidor.
6. Se rechazan los comentarios ejecutables de MySQL `/*! */` y los hints `/*+ */`.
7. **La sentencia debe ser del motor elegido.** `base.tabla` (MySQL) y `esquema.tabla` (PostgreSQL) se escriben igual, así que sin esta regla se conectaría al servidor equivocado y el error sería de conexión o de tabla inexistente. Se rechaza antes de conectar si la sentencia trae un rasgo del otro motor:

   | Motor elegido | Se rechaza si la sentencia trae |
   |---|---|
   | PostgreSQL | Primera parte del nombre (base) con prefijo `miosv2_` (convención de MySQL, Carteras Propias V1); alguna parte del nombre entre `` ` ``; `UPDATE LOW_PRIORITY` / `UPDATE IGNORE`; `LIMIT` u `ORDER BY` en el nivel principal del UPDATE (fuera de paréntesis) |
   | MySQL | Primera parte del nombre (esquema) con prefijo `tenant_` (convención de PostgreSQL); `base.esquema.tabla`; alguna parte del nombre entre `"`; conversiones `::` (ej. `::jsonb`) fuera de textos y comentarios; `UPDATE ONLY`; `RETURNING` o `ILIKE` en el nivel principal (fuera de paréntesis) |

   Mensaje, sin nombres de bases ni esquemas: `La sentencia 1 de 2 parece de MySQL, pero el motor elegido es PostgreSQL.` / `Elige el motor MySQL o ajusta la sentencia.`

   Los prefijos están en `PREFIJO_NOMBRE` (función `esDeOtroMotor`). Una base o esquema con otro nombre y sin ningún rasgo de sintaxis no se detecta: se ejecuta en el motor elegido y, si no corresponde, falla con el error del servidor.

Se valida **al crear, al editar** (si se envía sentencia o motor) **y otra vez justo antes de ejecutar**. Si no cumple: **422** y advertencia amarilla indicando cuál sentencia y por qué (`La sentencia 2 de 3 no tiene cláusula WHERE…`).

## Flujo en pantalla

1. **Registrar y ejecutar:** `POST /api/soporte` (queda en **Creado**, descripción `Creado.`) y enseguida `POST /api/soporte/:id/ejecutar`.
2. La respuesta trae el registro con su estado y mensaje:
   - **Completado:** alerta verde con botón **Copiar** arriba a la derecha (no hay otro botón). Al copiar, el formulario se limpia (0,6 s) para el siguiente caso.
   - **Error:** alerta roja y botón **Reintentar**.
3. **Reintentar:** `PATCH /api/soporte/:id` con los valores actuales del formulario (por si se corrigió la sentencia) y vuelve a ejecutar **el mismo registro**.

## Ejecución

1. **Rate limit** (si hay `rate_limit` activo): 429 al superar el límite por minuto (ver [09-configuracion](09-configuracion.md#rate-limit)).
2. **Cola:** `/ejecutar` encola un job en BullMQ (cola `ejecucion-sentencias`, Redis) y espera su resultado hasta **30 s**. El worker procesa **una ejecución a la vez** (`concurrency: 1`).
3. El worker pasa el caso a **En proceso** (y el usuario que ejecuta queda como responsable).
4. Busca en Configuración la fila **activa** con `nombre` = motor; la convierte y valida igual que al guardarla ([09-configuracion](09-configuracion.md#validación-de-conexiones)).
5. Abre una **conexión cruda por ejecución** (sin TypeORM, sin pool), siempre cerrada al final (en MySQL, con la base de la primera sentencia):
   - `host` `localhost` / `127.0.0.1` / `::1` se reemplaza por `HOST_LOCAL_ALIAS` (en Docker `host.docker.internal`); sin esa variable (tradicional) se usa tal cual.
   - **MySQL** (`mysql2`): `multipleStatements: false`.
   - **PostgreSQL** (`pg`): conecta a la `database` de la configuración; SSL si `ssl: true`; si hay `ssh_host`, antes abre un **túnel SSH** por el bastión y lo cierra al terminar ([09-configuracion](09-configuracion.md#postgresql-por-túnel-ssh-bastión)). Cada sentencia va por el protocolo extendido (una por llamada).
6. Ejecuta cada sentencia por separado **en una transacción**: o se aplican todas o ninguna (rollback ante el primer error).
7. Guarda **Completado** o **Error** con su mensaje en `descripcion`, y `/ejecutar` responde el registro actualizado ("Ejecución procesada.").

## Estados

```
Creado ──► En proceso ──┬──► Completado
                        └──► Error ──(Reintentar)──► En proceso
```

| Estado | Cuándo |
|---|---|
| Creado | Al registrar (`POST /api/soporte`) |
| En proceso | El worker tomó la ejecución |
| Completado | Todas las sentencias se aplicaron (commit) |
| Error | Cualquier falla: conexión, túnel, configuración, sentencia; no se aplicó nada |

Solo existen estos cuatro (enum de la columna `estado_soporte`). El estado nunca se cambia por `PATCH`: solo lo mueve `/ejecutar`.

## Mensajes de resultado

Se muestran con el componente de alerta (`frontend/src/app/shared/alerta-resultado/`): fondo sólido del color del tipo (verde éxito, rojo error, amarillo advertencia, azul info) con ícono, texto y botón **Copiar** en claro; la primera línea es el título si el mensaje trae varias.

| Caso | Mensaje (`descripcion`) |
|---|---|
| Completado | `✅ {Cliente}, la novedad fue resuelta correctamente; por favor revise nuevamente.🤝` |
| Error — sin conexión MySQL (`ETIMEDOUT`, `ECONNREFUSED`, `EHOSTUNREACH`, `ENETUNREACH`, `ENOTFOUND`, `EAI_AGAIN`, `ECONNRESET`, `PROTOCOL_CONNECTION_LOST`) | `Sin conexión con Carteras Propias V1.` + indicación de conectar la VPN corporativa o reportarlo por el grupo del equipo de desarrollo |
| Error — sin conexión PostgreSQL (mismos códigos, o timeout de conexión de `pg`) | `Sin conexión con la base PostgreSQL.` + indicación de reportarlo al Super Administrador para revisar la conexión (y el túnel) en Configuración |
| Error — túnel SSH (PostgreSQL) | `Falta SSH_KEY_PATH…` / `No se pudo leer la llave SSH…` / `La llave SSH está vacía…` / `No se pudo conectar al bastión SSH: motivo` |
| Error — acceso (credenciales, origen no permitido, permisos, base inexistente) | Mensaje propio por código del driver (`modules/soporte/error-ejecucion.util.ts`), sin el texto del driver. Ej. PostgreSQL `28000` (`no pg_hba.conf entry`): `El servidor PostgreSQL rechazó la conexión desde este servidor (puede exigir conexión cifrada).` — se resuelve con `"ssl": true` en la conexión (ver [09-configuracion](09-configuracion.md)) |
| Error — sentencia no permitida al ejecutar | El mismo mensaje de la validación |
| Error — falla en lote (más de una sentencia) | `Error en la sentencia N de M; no se aplicó ningún cambio.` + detalle del motor |
| Error — conexión inválida en Configuración | `La conexión "{motor}" en Configuración está incompleta o mal escrita.` + indicación de reportarlo al Super Administrador |
| Error — otro (una sola sentencia, conexión PostgreSQL, configuración faltante) | `Error al ejecutar la sentencia: detalle` |

El detalle del motor se recorta a 200 caracteres.

**Datos sensibles:** ningún mensaje muestra datos de la conexión. Antes de guardarse, `ocultarDatosConexion` reemplaza por `***` los valores de la conexión activa (`host`, `username`, `password`, `database`, `ssh_*`, y los hosts ya resueltos), las citas `'usuario'@'host'`, `user/host/database "…"` y las direcciones IP. El error completo queda solo en el log de `api`.

Errores HTTP que no cambian el estado y se muestran como aviso: **422** sentencia no válida (amarillo), **429** rate limit, **404** registro inexistente.

## Notas

- El rollback es completo en PostgreSQL y en tablas **InnoDB** de MySQL (MyISAM no es transaccional).
- La VPN que cuenta es la del equipo o servidor donde corre la API (en Docker, el contenedor `api`).
- **`/ejecutar` no valida el estado actual:** por API se puede volver a ejecutar un caso Completado (re-aplica el UPDATE) o uno En proceso. La pantalla solo ofrece reintentar desde Error.
- **Timeout de 30 s:** si la ejecución no termina en ese tiempo, la API responde error genérico (500), pero el job sigue en la cola: el caso queda En proceso y termina en Completado o Error cuando el worker acabe. La pantalla pierde la referencia; revisar el resultado en Informes antes de volver a registrar.
- Eliminar (`DELETE`) es lógico: descripción `Eliminado.`, `estado_registro = 0`. Informes sigue mostrando los eliminados.

## Endpoints (`/api/soporte`)

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/` | Soporte → Consultar | Listado paginado (`page`, `limit`), más recientes primero |
| GET | `/motores` | Soporte → Crear | Pares `nombre`/`alcance` sin repetir de las conexiones activas (`mysql`, `postgres`) de Configuración |
| GET | `/clientes?q=` | Soporte → Crear | Clientes distintos que contienen `q` (máx. 100 caracteres), hasta 10 |
| GET | `/:id` | Soporte → Consultar | Un caso |
| POST | `/` | Soporte → Crear | Registra en estado Creado (valida la sentencia) |
| POST | `/:id/ejecutar` | Soporte → Editar | Rate limit, cola, ejecución; devuelve el caso actualizado |
| PATCH | `/:id` | Soporte → Editar | Cliente, novedad, mensaje, motor, sentencia, estado de registro (nunca `estadoSoporte`) |
| DELETE | `/:id` | Soporte → Eliminar | Soft delete |

## Código

| Qué | Dónde |
|---|---|
| Servicio (registro, clientes, ejecución, mensajes, rate limit) | `backend/src/modules/soporte/soporte.service.ts` |
| Worker de la cola | `backend/src/modules/soporte/ejecucion.processor.ts`, `ejecucion.constants.ts` |
| Entidad y estados | `backend/src/modules/soporte/soporte.entity.ts` |
| Validación de sentencias | `backend/src/common/sql/sentencia-update.util.ts` |
| Conexiones crudas y túnel | `backend/src/common/raw-db/` (`raw-mysql.service.ts`, `raw-postgres.service.ts`, `tunel-ssh.ts`, `error-sentencia.ts`) |
| Pantalla | `frontend/src/app/features/soporte/` |
| Validación en vivo | `frontend/src/app/core/utils/sentencia.util.ts` |
| Alerta de resultado | `frontend/src/app/shared/alerta-resultado/alerta-resultado.component.ts` |

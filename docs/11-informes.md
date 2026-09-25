# 11 · Informes

Consulta de los casos registrados en Soporte: filtros, tarjetas de resumen, tabla con detalle y exportación a Excel.

## Acceso

| Qué | Permiso |
|---|---|
| Pantalla, tabla, resumen, filtro Usuario y Excel | Informe → Consultar (única acción del menú Informe) |
| Opciones del filtro Novedad | Novedades → Opciones (sin él, el filtro queda vacío) |

En el seed tienen acceso Super Administrador, Administrador, Desarrollador(a) y **Aprendiz Sena**, cuyo único menú es Informe (Informe → Consultar y Novedades → Opciones para el filtro; ver [05-permisos](05-permisos.md)).

## Universo de datos

- Tabla `soporte`, **incluidos los registros eliminados** (`withDeleted()` en `construirConsulta` de `informes.service.ts`). Un caso eliminado aparece con Registro **Inactivo** en el detalle y "Estado registro" Inactivo en el Excel.
- La novedad también se trae aunque esté eliminada o inactiva.
- El rango de fechas filtra por **fecha de creación** del caso.

## Filtros

| Filtro | Tipo | Regla |
|---|---|---|
| Rango de fechas | Calendario de rango (`yy-mm-dd`) | Por defecto hoy–hoy. Se aplica al cerrar el calendario. Días en **zona Bogotá** (UTC-5): desde 00:00:00 hasta 23:59:59.999. Con una sola fecha, ese día; sin fechas, hoy en Bogotá |
| Novedad | Selección múltiple con buscador | Novedades activas (`GET /api/novedades/opciones`) |
| Usuario | Selección múltiple con buscador | Solo quienes figuran como responsables en `soporte` (incluidos registros y usuarios eliminados), nombre completo, orden alfabético (`GET /api/informes/usuarios`) |
| Estado Soporte | Selección múltiple | Creado, En proceso, Completado, Error |

Vacío = sin filtro. Los filtros se combinan con Y; dentro de un filtro múltiple, con O.

Al cambiar fecha, novedad o usuario se recargan tabla y tarjetas; al cambiar estado, solo la tabla (y Total). La tabla vuelve a la página 1.

## Tarjetas de resumen

| Tarjeta | Qué cuenta | Filtros que aplica |
|---|---|---|
| **Total** (primera) | Total de registros de la tabla: `pagination.total` de `GET /api/informes`, calculado con `COUNT` en el backend (soporta millones sin traer filas) | **Todos**, incluido estado |
| Creado · En proceso · Completado · Error | Conteo por estado (`GET /api/informes/resumen`, `COUNT … GROUP BY estado_soporte`) | Fecha, novedad y usuario; **ignoran el filtro de estado** |

Colores e íconos: Total (primario, `pi-list`), Creado (gris), En proceso (ámbar), Completado (verde), Error (rojo). Un estado sin casos muestra 0.

## Tabla

Paginada en el servidor (10 por página), más recientes primero (`id` DESC).

| Columna | Contenido |
|---|---|
| (flecha) | Indica si la fila está desplegada |
| Número | `id` del caso |
| Cliente | Como se guardó (capitalizado) |
| Novedad | Nombre de la novedad |
| Motor | `MySQL` / `PostgreSQL` |
| Estado | Etiqueta de color (Creado gris, En proceso ámbar, Completado verde, Error rojo) |
| Sentencia | Recortada, monoespaciada; tooltip con hasta 300 caracteres (`… (ver detalle)`) |
| Responsable | **Nombre completo** (primer y segundo nombre, primer y segundo apellido, omitiendo vacíos) del **último usuario que modificó** el caso (quien registró, editó o ejecutó) |
| Creación | Fecha y hora de creación |

**Clic (o Enter) en cualquier parte de la fila** despliega el detalle, con botón **Copiar** en cada sección:

1. Mensaje de WhatsApp
2. Sentencia (completa, formato código)
3. Descripción (mensaje de resultado, con ícono y línea del color del estado)

Debajo: Registro (Activo/Inactivo), Creación y Actualización.

Celdas vacías se muestran como `---`.

## Excel

**Exportar a Excel** (`GET /api/informes/exportar`) descarga **todos** los registros con los filtros actuales (incluido estado), sin paginar, más recientes primero. Archivo `informes-soporte-AAAA-MM-DD.xlsx`, hoja `Informes`. Vacíos como `---`.

| Columna | Contenido |
|---|---|
| Número | `id` |
| Cliente | Cliente |
| Novedad | Nombre de la novedad |
| Mensaje WhatsApp | Completo |
| Motor | `MySQL` / `PostgreSQL` |
| Sentencia | Completa |
| Estado soporte | Creado / En proceso / Completado / Error |
| Estado registro | Activo / Inactivo |
| Descripción | Mensaje de resultado |
| Responsable | Nombre completo |
| Fecha creación | Fecha y hora |
| Fecha actualización | Fecha y hora |

## Endpoints (`/api/informes`)

Todos con permiso **Informe → Consultar**. Filtros por query: `fechaInicio`, `fechaFin` (`YYYY-MM-DD`), `idNovedad`, `idUsuario`, `estadoSoporte` (repetibles: `?idNovedad=1&idNovedad=4`).

| Método | Ruta | Uso |
|---|---|---|
| GET | `/` | Listado paginado (`page`, `limit`) con Responsable; `pagination.total` alimenta la tarjeta Total |
| GET | `/resumen` | `{ Creado, En proceso, Completado, Error }` sin filtro de estado |
| GET | `/usuarios` | Opciones del filtro Usuario (`id`, `nombreCompleto`) |
| GET | `/exportar` | Archivo `.xlsx` (respuesta binaria, sin envelope) |

## Código

| Qué | Dónde |
|---|---|
| Consultas, resumen, Excel, zona horaria | `backend/src/modules/informes/informes.service.ts` |
| Filtros (DTO) | `backend/src/modules/informes/dto/filtros-informes.dto.ts` |
| Nombre completo del responsable | `backend/src/common/utils/responsable.util.ts` |
| Pantalla | `frontend/src/app/features/informes/` |

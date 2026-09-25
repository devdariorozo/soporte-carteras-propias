# 08 · Novedades

Catálogo que clasifica cada caso de Soporte (qué le pasó al cliente). Cada caso de `soporte` guarda el `id_novedad` (llave foránea a `novedades`).

## Campos y reglas

| Campo | Regla |
|---|---|
| Novedad | Obligatoria, 3–45. Se guarda con **mayúscula inicial por palabra** y el resto en minúscula (`subir ACUERDO` → `Subir Acuerdo`), espacios repetidos colapsados |
| Estado | Solo al editar: Activo (1) / Inactivo (0) |
| Descripción | Opcional, 3–255. Primera letra en mayúscula |

- **Sin duplicados:** se compara el nombre ya capitalizado; la collation de la base (`utf8mb4_unicode_ci`) no distingue mayúsculas ni tildes. Duplicado → 409 "La novedad ya existe.".
- La comparación no incluye novedades eliminadas: un nombre eliminado se puede volver a crear.
- Eliminar es lógico (soft delete). Los casos de Soporte que ya la usan la conservan y en Informes siguen mostrando su nombre.
- Inactivar o eliminar una novedad la quita de los selects (Soporte e Informes), no de los casos existentes.

## Catálogo inicial (seed, 21)

Estandarizado a partir del histórico del chat de soporte (abr–sep 2026), de mayor a menor frecuencia:

Romper Acuerdo · Subir Novación · Subir Acuerdo · Aprobar Acuerdo · Caída De Soul · Pago En Landing · Código De Pago No Llega · Envío De Acuerdo Por Correo · Descargar Acuerdo · Búsqueda De Clientes · Lentitud De Soul · Actualizar Correo Del Cliente · Permisos De Usuario · Novación En Cero · Cierre De Novación Con Deuda Activa · Selección De Banco En Pago · Cargue De Pagos · Extracción De Estrategia · Promesa Sin Gestión Asociada · Cliente No Existe En Cartera · Descargar Certificado De Deuda

El seed crea cada una solo si no existe con ese nombre (incluidas las eliminadas).

## Uso en otras pantallas

| Pantalla | Cómo la usa |
|---|---|
| Soporte | Select **Novedad** (obligatorio, con buscador) desde `GET /api/novedades/opciones` |
| Informes | Filtro **Novedad** (selección múltiple) desde el mismo endpoint; columna Novedad en la tabla y en el Excel |

`/opciones` devuelve solo las activas (`id`, `novedad`), en orden alfabético. Requiere `Novedades → Opciones`; sin ese permiso el select queda vacío.

## Permisos por rol (seed)

| Rol | Acciones |
|---|---|
| Super Administrador / Administrador | Crear, Editar, Eliminar, Consultar, Opciones |
| Desarrollador(a) | Crear, Editar, Consultar, Opciones (no elimina) |
| Aprendiz Sena | Opciones (solo para el filtro de Informes; no ve el menú Novedades) |

## Endpoints (`/api/novedades`)

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/opciones` | Novedades → Opciones | Activas para selects |
| GET | `/` | Novedades → Consultar | Listado paginado (`page`, `limit`), más recientes primero, con Responsable |
| GET | `/:id` | Novedades → Consultar | Una novedad |
| POST | `/` | Novedades → Crear | Crea (activa) |
| PATCH | `/:id` | Novedades → Editar | Nombre, descripción y/o estado |
| DELETE | `/:id` | Novedades → Eliminar | Soft delete |

## Código

| Qué | Dónde |
|---|---|
| Entidad, servicio, controlador, DTOs | `backend/src/modules/novedades/` |
| Capitalización (`capitalizarPalabras`) | `backend/src/common/utils/texto.util.ts` |
| Seed (`NOVEDADES_INICIALES`) | `backend/src/database/seeds/run-seed.ts` |
| Pantalla | `frontend/src/app/features/novedades/` |

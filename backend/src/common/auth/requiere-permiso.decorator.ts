import { SetMetadata } from '@nestjs/common';
import { AccionPermiso, ModuloPermiso } from '../../modules/permisos/permiso.entity.js';

export const REQUIERE_PERMISO_KEY = 'requiere_permiso';

export interface PermisoRequerido {
  menu: ModuloPermiso;
  accion: AccionPermiso;
}

/**
 * Exige que el rol del usuario autenticado tenga la fila (rol + menu + acción)
 * correspondiente en `permisos` — la fuente de verdad es la fila, nunca el nombre del
 * rol directamente (ver planing/03-modelo-datos.md).
 */
export const RequierePermiso = (menu: ModuloPermiso, accion: AccionPermiso): MethodDecorator =>
  SetMetadata(REQUIERE_PERMISO_KEY, { menu, accion } satisfies PermisoRequerido);

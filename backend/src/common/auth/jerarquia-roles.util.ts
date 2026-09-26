import { ForbiddenException } from '@nestjs/common';
import { FindOperator, MoreThanOrEqual } from 'typeorm';
import { NombreRol } from '../../modules/roles/rol.entity.js';

/** Ruta de la opción de menú Configuración (ver MENU_FINAL en el seed). */
export const RUTA_CONFIGURACION = '/configuracion';

/** Únicos roles que pueden tener el Tablero (endpoint `@Roles` y asignación de su permiso). */
export const ROLES_TABLERO: string[] = [NombreRol.SUPER_ADMINISTRADOR, NombreRol.ADMINISTRADOR];

/** Quien actúa: sale del access token (`AccessTokenPayload`). */
export interface Actor {
  idRol: number;
  rol: string;
}

/**
 * Jerarquía de roles por id: 1 = Super Administrador, 2 = Administrador, 3 = Desarrollador(a), 4 = Aprendiz Sena, y
 * los roles que se creen después quedan por debajo (id mayor). Un rol administra los
 * roles de su mismo nivel hacia abajo (id >= el suyo) — sus permisos y sus usuarios —
 * pero nunca los que están por encima (id menor).
 */
export function puedeGestionarRol(actor: Actor, idRolObjetivo: number): boolean {
  return idRolObjetivo >= actor.idRol;
}

/** Filtro `where` para listados: solo roles del nivel del actor hacia abajo (id de rol >= el suyo). */
export function rolesVisibles(actor: Actor): FindOperator<number> {
  return MoreThanOrEqual(actor.idRol);
}

export function exigirJerarquia(actor: Actor, idRolObjetivo: number | null | undefined, titulo: string, mensaje: string): void {
  if (idRolObjetivo !== null && idRolObjetivo !== undefined && !puedeGestionarRol(actor, idRolObjetivo)) {
    throw new ForbiddenException({ title: titulo, message: mensaje });
  }
}

/** Configuración del sistema: exclusiva del Super Administrador, sin importar la jerarquía. */
export function exigirSuperAdministrador(actor: Actor, condicion: boolean, titulo: string, mensaje: string): void {
  if (condicion && actor.rol !== NombreRol.SUPER_ADMINISTRADOR) {
    throw new ForbiddenException({ title: titulo, message: mensaje });
  }
}

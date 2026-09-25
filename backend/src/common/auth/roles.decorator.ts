import { SetMetadata } from '@nestjs/common';
import { NombreRol } from '../../modules/roles/rol.entity.js';

export const ROLES_KEY = 'roles';

/**
 * Restringe el endpoint por nombre de rol (ej. reseteo asistido de contraseña). No
 * reemplaza el guard de permisos por fila de `permisos` de la Fase 2 — se usa solo
 * donde `planing/06-seguridad-sesion.md` ya define la restricción por rol.
 */
export const Roles = (...roles: NombreRol[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

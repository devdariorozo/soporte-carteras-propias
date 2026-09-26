/**
 * Misma regla que el backend (`common/auth/jerarquia-roles.util.ts`): un rol administra
 * los roles de su nivel hacia abajo (id >= el suyo), sus permisos y sus usuarios, nunca
 * los que están por encima. Configuración es exclusiva del Super Administrador. Aquí
 * solo se ocultan opciones en la UI; el backend es quien lo hace cumplir.
 */
export const ROL_SUPER_ADMINISTRADOR = 'Super Administrador';
export const MENU_CONFIGURACION = 'Configuración';
export const RUTA_CONFIGURACION = '/configuracion';

/** El Tablero es exclusivo de estos roles: su permiso no se asigna a ningún otro (el backend lo rechaza con 403). */
export const MENU_TABLERO = 'Tablero';
export const ROLES_TABLERO = [ROL_SUPER_ADMINISTRADOR, 'Administrador'];

export function esSuperAdministrador(rol: string | null | undefined): boolean {
  return rol === ROL_SUPER_ADMINISTRADOR;
}

/** Sesión guardada antes de que el login devolviera `idRol`: el Super Administrador sigue siendo 1; el resto no gestiona nada hasta reingresar. */
export function nivelRol(usuario: { idRol?: number; rol: string } | null | undefined): number {
  if (usuario?.idRol) {
    return usuario.idRol;
  }
  return esSuperAdministrador(usuario?.rol) ? 1 : Number.MAX_SAFE_INTEGER;
}

export function puedeGestionarRol(nivelActor: number, idRolObjetivo: number): boolean {
  return idRolObjetivo >= nivelActor;
}

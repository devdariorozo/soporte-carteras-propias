import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableBaseEntity } from '../../common/entities/auditable.base-entity.js';
import { Rol } from '../roles/rol.entity.js';

/**
 * Los valores deben ser IDÉNTICOS a como se crea cada opción en el módulo Menu
 * (campo `menu`, ver menu.entity.ts) — Permisos ya no valida contra este enum
 * cerrado, sino contra las opciones de menú activas (ver PermisosService); este
 * enum solo documenta/fija el valor esperado para las 8 opciones sembradas y para
 * los `@RequierePermiso(...)` de cada controller.
 */
export enum ModuloPermiso {
  ROLES = 'Roles',
  PERMISOS = 'Permisos',
  USUARIOS = 'Usuarios',
  NOVEDADES = 'Novedades',
  CONFIGURACION = 'Configuración',
  SOPORTE = 'Soporte',
  INFORMES = 'Informe',
  MENU = 'Menu',
}

export enum AccionPermiso {
  CREAR = 'Crear',
  EDITAR = 'Editar',
  ELIMINAR = 'Eliminar',
  CONSULTAR = 'Consultar',
  /** Cargar las opciones del módulo en los selects de otras vistas (ej. Roles en el formulario de Usuarios). */
  OPCIONES = 'Opciones',
}

const ACCIONES_CRUD = [AccionPermiso.CREAR, AccionPermiso.EDITAR, AccionPermiso.ELIMINAR, AccionPermiso.CONSULTAR];

/**
 * Acciones que admite cada menú — solo las que el sistema usa de verdad. `Opciones`
 * solo en los módulos que alimentan selects de otras vistas (`GET /<modulo>/opciones`);
 * Informe solo lista, resume y exporta, todo bajo `Consultar`. Menús sin entrada
 * (creados después desde el módulo Menu) admiten el CRUD. El frontend replica esta
 * regla en `permisos.component.ts`.
 */
export const ACCIONES_POR_MENU: Partial<Record<string, AccionPermiso[]>> = {
  [ModuloPermiso.ROLES]: [...ACCIONES_CRUD, AccionPermiso.OPCIONES],
  [ModuloPermiso.USUARIOS]: [...ACCIONES_CRUD, AccionPermiso.OPCIONES],
  [ModuloPermiso.NOVEDADES]: [...ACCIONES_CRUD, AccionPermiso.OPCIONES],
  [ModuloPermiso.INFORMES]: [AccionPermiso.CONSULTAR],
};

export function accionesPermitidas(menu: string): AccionPermiso[] {
  return ACCIONES_POR_MENU[menu] ?? ACCIONES_CRUD;
}

@Entity('permisos')
export class Permiso extends AuditableBaseEntity {
  @Column({ name: 'id_rol', type: 'int' })
  idRol: number;

  @ManyToOne(() => Rol, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_rol' })
  rolRef: Rol;

  /** Debe ser igual a un `menu.menu` activo (ver PermisosService.validarMenu) — ya no es un enum cerrado. */
  @Column({ name: 'menu', type: 'varchar', length: 45 })
  menu: string;

  @Column({ name: 'permiso', type: 'varchar', length: 45 })
  permiso: AccionPermiso;
}

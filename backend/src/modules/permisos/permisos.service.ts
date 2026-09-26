import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { asignarDefinidos } from '../../common/utils/asignar-definidos.util.js';
import { adjuntarResponsables } from '../../common/utils/responsable.util.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Menu } from '../menu/menu.entity.js';
import { AccionPermiso, ModuloPermiso, Permiso, accionesPermitidas } from './permiso.entity.js';
import {
  Actor,
  ROLES_TABLERO,
  exigirJerarquia,
  exigirSuperAdministrador,
  puedeGestionarRol,
  rolesVisibles,
} from '../../common/auth/jerarquia-roles.util.js';
import { NombreRol, Rol } from '../roles/rol.entity.js';
import { CrearPermisoDto } from './dto/crear-permiso.dto.js';
import { ActualizarPermisoDto } from './dto/actualizar-permiso.dto.js';

const TITULO = 'Permisos';

@Injectable()
export class PermisosService {
  constructor(
    @InjectRepository(Permiso) private readonly permisos: Repository<Permiso>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Menu) private readonly menus: Repository<Menu>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
  ) {}

  async create(dto: CrearPermisoDto, idUsuario: number, actor: Actor) {
    this.validarAlcance(dto.menu, dto.idRol, actor);
    await this.validarMenu(dto.menu);
    this.validarAccion(dto.menu, dto.permiso);
    await this.validarRolTablero(dto.menu, dto.idRol);
    await this.validarNoDuplicado(dto.idRol, dto.menu, dto.permiso);
    const { idRol, menu, permiso: accion, descripcion } = dto;
    const permiso = await this.permisos.save(
      this.permisos.create({ idRol, menu, permiso: accion, idUsuario, descripcion: descripcion ?? null, estadoRegistro: 1 }),
    );
    return { message: 'Permiso creado correctamente.', data: permiso };
  }

  /** Solo permisos de roles del nivel del actor hacia abajo; los de Configuración, solo para el Super Administrador. */
  async findAll(query: PaginacionQueryDto, actor: Actor) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.permisos.findAndCount({
      where: {
        idRol: rolesVisibles(actor),
        ...(actor.rol === NombreRol.SUPER_ADMINISTRADOR ? {} : { menu: Not(ModuloPermiso.CONFIGURACION) }),
      },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
      relations: { rolRef: true },
    });
    return { data: await adjuntarResponsables(this.usuarios, data), pagination: buildPaginationBlock(total, page, limit) };
  }

  async findOne(id: number, actor: Actor) {
    const permiso = await this.obtenerOFallar(id);
    const visible =
      puedeGestionarRol(actor, permiso.idRol) &&
      (actor.rol === NombreRol.SUPER_ADMINISTRADOR || permiso.menu !== ModuloPermiso.CONFIGURACION);
    if (!visible) {
      throw new NotFoundException({ title: TITULO, message: 'Permiso no encontrado.' });
    }
    return { data: permiso };
  }

  async update(id: number, dto: ActualizarPermisoDto, idUsuario: number, actor: Actor) {
    const permiso = await this.obtenerOFallar(id);
    this.validarAlcance(permiso.menu, permiso.idRol, actor);
    this.validarAlcance(dto.menu ?? permiso.menu, dto.idRol ?? permiso.idRol, actor);
    if (dto.menu !== undefined) {
      await this.validarMenu(dto.menu);
    }
    this.validarAccion(dto.menu ?? permiso.menu, dto.permiso ?? permiso.permiso);
    await this.validarRolTablero(dto.menu ?? permiso.menu, dto.idRol ?? permiso.idRol);
    await this.validarNoDuplicado(dto.idRol ?? permiso.idRol, dto.menu ?? permiso.menu, dto.permiso ?? permiso.permiso, id);
    asignarDefinidos(permiso, dto);
    permiso.idUsuario = idUsuario;
    await this.permisos.save(permiso);
    return { message: 'Permiso actualizado correctamente.', data: permiso };
  }

  async remove(id: number, idUsuario: number, actor: Actor) {
    const permiso = await this.obtenerOFallar(id);
    this.validarAlcance(permiso.menu, permiso.idRol, actor);
    await this.permisos.update(id, { estadoRegistro: 0, idUsuario });
    await this.permisos.softDelete(id);
    return { message: 'Permiso eliminado correctamente.' };
  }

  async misPermisos(idRol: number) {
    const permisos = await this.permisos.find({
      where: { idRol, estadoRegistro: 1 },
      select: { menu: true, permiso: true },
      order: { menu: 'ASC', permiso: 'ASC' },
    });
    return { data: permisos };
  }

  /** El valor debe ser idéntico al de una opción de menú activa (ver menu.entity.ts / plan de trabajo). */
  private async validarMenu(menu: string): Promise<void> {
    const existe = await this.menus.exists({ where: { menu, estadoRegistro: 1 } });
    if (!existe) {
      throw new BadRequestException({
        title: TITULO,
        message: 'El valor de Menu debe ser igual al de una opción de menú activa.',
      });
    }
  }

  /** Solo permisos de roles de su nivel hacia abajo; los de Configuración, solo el Super Administrador. */
  private validarAlcance(menu: string, idRol: number, actor: Actor): void {
    exigirJerarquia(actor, idRol, TITULO, 'No puedes gestionar permisos de un rol por encima del tuyo.');
    exigirSuperAdministrador(
      actor,
      menu === ModuloPermiso.CONFIGURACION,
      TITULO,
      'Solo el Super Administrador puede gestionar permisos de Configuración.',
    );
  }

  /**
   * Un mismo rol + menú + acción solo puede existir una vez (activo o inactivo; los
   * eliminados no cuentan). Si está inactivo, se reactiva editándolo, no creando otro.
   */
  private async validarNoDuplicado(idRol: number, menu: string, accion: AccionPermiso, idExcluido?: number): Promise<void> {
    const existente = await this.permisos.findOne({ where: { idRol, menu, permiso: accion } });
    if (existente && existente.id !== idExcluido) {
      throw new ConflictException({
        title: TITULO,
        message: `Ese permiso ya existe (${menu} / ${accion} para este rol)${existente.estadoRegistro === 1 ? '' : ', está inactivo: edítalo para activarlo'}.`,
      });
    }
  }

  /** El Tablero es exclusivo de Super Administrador y Administrador: su permiso no se asigna a otro rol. */
  private async validarRolTablero(menu: string, idRol: number): Promise<void> {
    if (menu !== ModuloPermiso.TABLERO) return;
    const rol = await this.roles.findOne({ where: { id: idRol } });
    if (!rol || !ROLES_TABLERO.includes(rol.rol)) {
      throw new ForbiddenException({
        title: TITULO,
        message: 'El Tablero solo puede asignarse a los roles Super Administrador y Administrador.',
      });
    }
  }

  /** Ej. Informe solo admite `Consultar` (ver `ACCIONES_POR_MENU`). */
  private validarAccion(menu: string, accion: AccionPermiso): void {
    const permitidas = accionesPermitidas(menu);
    if (!permitidas.includes(accion)) {
      throw new BadRequestException({
        title: TITULO,
        message: `El menú ${menu} solo admite: ${permitidas.join(', ')}.`,
      });
    }
  }

  private async obtenerOFallar(id: number): Promise<Permiso> {
    const permiso = await this.permisos.findOne({ where: { id } });
    if (!permiso) {
      throw new NotFoundException({ title: TITULO, message: 'Permiso no encontrado.' });
    }
    return permiso;
  }
}

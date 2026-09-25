import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { asignarDefinidos } from '../../common/utils/asignar-definidos.util.js';
import { adjuntarResponsables } from '../../common/utils/responsable.util.js';
import { capitalizarPalabras } from '../../common/utils/texto.util.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Menu } from './menu.entity.js';
import { Actor, RUTA_CONFIGURACION, exigirSuperAdministrador } from '../../common/auth/jerarquia-roles.util.js';
import { CrearMenuDto } from './dto/crear-menu.dto.js';
import { ActualizarMenuDto } from './dto/actualizar-menu.dto.js';

const TITULO = 'Menú';
const MENSAJE_CONFIGURACION = 'Solo el Super Administrador puede modificar o eliminar la opción de menú Configuración.';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu) private readonly menus: Repository<Menu>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async create(dto: CrearMenuDto, idUsuario: number) {
    const apartado = capitalizarPalabras(dto.apartado);
    const menu = capitalizarPalabras(dto.menu);
    await this.validarNoDuplicado({ menu, ruta: dto.ruta, orden: dto.orden });

    const registro = await this.menus.save(
      this.menus.create({
        apartado,
        menu,
        ruta: dto.ruta,
        icono: dto.icono,
        orden: dto.orden,
        idUsuario,
        descripcion: dto.descripcion ?? null,
        estadoRegistro: 1,
      }),
    );
    return { message: 'Menú creado correctamente.', data: registro };
  }

  async findAll(query: PaginacionQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.menus.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
    });
    return { data: await adjuntarResponsables(this.usuarios, data), pagination: buildPaginationBlock(total, page, limit) };
  }

  /** Sidebar: todos los activos, ordenados — cualquier usuario autenticado (el gating real es por permiso de módulo). */
  async activos() {
    const data = await this.menus.find({ where: { estadoRegistro: 1 }, order: { orden: 'ASC' } });
    return { data };
  }

  async findOne(id: number) {
    const registro = await this.obtenerOFallar(id);
    return { data: registro };
  }

  async update(id: number, dto: ActualizarMenuDto, idUsuario: number, actor: Actor) {
    const registro = await this.obtenerOFallar(id);
    this.validarReservadoSuperAdmin(registro, actor);
    exigirSuperAdministrador(actor, dto.ruta === RUTA_CONFIGURACION, TITULO, MENSAJE_CONFIGURACION);
    const apartado = dto.apartado !== undefined ? capitalizarPalabras(dto.apartado) : undefined;
    const menu = dto.menu !== undefined ? capitalizarPalabras(dto.menu) : undefined;
    await this.validarNoDuplicado({ menu, ruta: dto.ruta, orden: dto.orden }, id);

    asignarDefinidos(registro, dto);
    if (apartado !== undefined) registro.apartado = apartado;
    if (menu !== undefined) registro.menu = menu;
    registro.idUsuario = idUsuario;
    await this.menus.save(registro);
    return { message: 'Menú actualizado correctamente.', data: registro };
  }

  async remove(id: number, idUsuario: number, actor: Actor) {
    const registro = await this.obtenerOFallar(id);
    this.validarReservadoSuperAdmin(registro, actor);
    await this.menus.update(id, { estadoRegistro: 0, idUsuario });
    await this.menus.softDelete(id);
    return { message: 'Menú eliminado correctamente.' };
  }

  /** La opción Configuración (renombrarla rompe sus permisos) solo la modifica el Super Administrador. */
  private validarReservadoSuperAdmin(registro: Menu, actor: Actor): void {
    exigirSuperAdministrador(actor, registro.ruta === RUTA_CONFIGURACION, TITULO, MENSAJE_CONFIGURACION);
  }

  private async validarNoDuplicado(
    campos: { menu?: string; ruta?: string; orden?: number },
    idExcluido?: number,
  ): Promise<void> {
    if (campos.menu !== undefined) {
      const existente = await this.menus.findOne({ where: { menu: campos.menu } });
      if (existente && existente.id !== idExcluido) {
        throw new ConflictException({ title: TITULO, message: 'Ya existe una opción de menú con ese nombre.' });
      }
    }
    if (campos.ruta !== undefined) {
      const existente = await this.menus.findOne({ where: { ruta: campos.ruta } });
      if (existente && existente.id !== idExcluido) {
        throw new ConflictException({ title: TITULO, message: 'Ya existe una opción de menú con esa ruta.' });
      }
    }
    if (campos.orden !== undefined) {
      const existente = await this.menus.findOne({ where: { orden: campos.orden } });
      if (existente && existente.id !== idExcluido) {
        throw new ConflictException({ title: TITULO, message: 'Ya existe una opción de menú con ese orden.' });
      }
    }
  }

  private async obtenerOFallar(id: number): Promise<Menu> {
    const registro = await this.menus.findOne({ where: { id } });
    if (!registro) {
      throw new NotFoundException({ title: TITULO, message: 'Opción de menú no encontrada.' });
    }
    return registro;
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { asignarDefinidos } from '../../common/utils/asignar-definidos.util.js';
import { adjuntarResponsables } from '../../common/utils/responsable.util.js';
import { capitalizarPalabras } from '../../common/utils/texto.util.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Rol } from './rol.entity.js';
import { Actor, exigirJerarquia, puedeGestionarRol, rolesVisibles } from '../../common/auth/jerarquia-roles.util.js';
import { CrearRolDto } from './dto/crear-rol.dto.js';
import { ActualizarRolDto } from './dto/actualizar-rol.dto.js';

const TITULO = 'Roles';
const MENSAJE_DUPLICADO = 'El rol ya existe.';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async create(dto: CrearRolDto, idUsuario: number) {
    const nombre = capitalizarPalabras(dto.rol);
    await this.validarNoDuplicado(nombre);

    const rol = await this.roles.save(
      this.roles.create({ rol: nombre, idUsuario, descripcion: dto.descripcion ?? null, estadoRegistro: 1 }),
    );
    return { message: 'Rol creado correctamente.', data: rol };
  }

  /** Solo los roles del nivel del actor hacia abajo — los de arriba ni se listan. */
  async findAll(query: PaginacionQueryDto, actor: Actor) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.roles.findAndCount({
      where: { id: rolesVisibles(actor) },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
    });
    return { data: await adjuntarResponsables(this.usuarios, data), pagination: buildPaginationBlock(total, page, limit) };
  }

  async findOne(id: number, actor: Actor) {
    const rol = await this.obtenerVisibleOFallar(id, actor);
    return { data: rol };
  }

  /** Roles activos asignables (id + nombre) para selects, del nivel del actor hacia abajo. */
  async opciones(actor: Actor) {
    const data = await this.roles.find({
      where: { id: rolesVisibles(actor), estadoRegistro: 1 },
      select: ['id', 'rol'],
      order: { id: 'ASC' },
    });
    return { data };
  }

  async update(id: number, dto: ActualizarRolDto, idUsuario: number, actor: Actor) {
    const rol = await this.obtenerOFallar(id);
    exigirJerarquia(actor, rol.id, TITULO, 'No puedes gestionar un rol por encima del tuyo.');
    if (dto.rol !== undefined) {
      const nombre = capitalizarPalabras(dto.rol);
      await this.validarNoDuplicado(nombre, id);
      dto = { ...dto, rol: nombre };
    }
    asignarDefinidos(rol, dto);
    rol.idUsuario = idUsuario;
    await this.roles.save(rol);
    return { message: 'Rol actualizado correctamente.', data: rol };
  }

  async remove(id: number, idUsuario: number, actor: Actor) {
    const rol = await this.obtenerOFallar(id);
    exigirJerarquia(actor, rol.id, TITULO, 'No puedes gestionar un rol por encima del tuyo.');
    await this.roles.update(id, { estadoRegistro: 0, idUsuario });
    await this.roles.softDelete(id);
    return { message: 'Rol eliminado correctamente.' };
  }

  private async validarNoDuplicado(nombre: string, idExcluido?: number): Promise<void> {
    const existente = await this.roles.findOne({ where: { rol: nombre } });
    if (existente && existente.id !== idExcluido) {
      throw new ConflictException({ title: TITULO, message: MENSAJE_DUPLICADO });
    }
  }

  /** Un rol por encima del actor responde igual que uno inexistente: no se revela. */
  private async obtenerVisibleOFallar(id: number, actor: Actor): Promise<Rol> {
    if (!puedeGestionarRol(actor, id)) {
      throw new NotFoundException({ title: TITULO, message: 'Rol no encontrado.' });
    }
    return this.obtenerOFallar(id);
  }

  private async obtenerOFallar(id: number): Promise<Rol> {
    const rol = await this.roles.findOne({ where: { id } });
    if (!rol) {
      throw new NotFoundException({ title: TITULO, message: 'Rol no encontrado.' });
    }
    return rol;
  }
}

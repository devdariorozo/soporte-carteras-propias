import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { adjuntarResponsables } from '../../common/utils/responsable.util.js';
import { capitalizarPalabras } from '../../common/utils/texto.util.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Novedad } from './novedad.entity.js';
import { CrearNovedadDto } from './dto/crear-novedad.dto.js';
import { ActualizarNovedadDto } from './dto/actualizar-novedad.dto.js';

const TITULO = 'Novedades';
const MENSAJE_DUPLICADO = 'La novedad ya existe.';

@Injectable()
export class NovedadesService {
  constructor(
    @InjectRepository(Novedad) private readonly novedades: Repository<Novedad>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async create(dto: CrearNovedadDto, idUsuario: number) {
    const nombre = capitalizarPalabras(dto.novedad);
    await this.validarNoDuplicado(nombre);

    const novedad = await this.novedades.save(
      this.novedades.create({
        novedad: nombre,
        idUsuario,
        descripcion: dto.descripcion ?? null,
        estadoRegistro: 1,
      }),
    );
    return { message: 'Novedad creada correctamente.', data: novedad };
  }

  async findAll(query: PaginacionQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.novedades.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
    });
    return { data: await adjuntarResponsables(this.usuarios, data), pagination: buildPaginationBlock(total, page, limit) };
  }

  async findOne(id: number) {
    const novedad = await this.obtenerOFallar(id);
    return { data: novedad };
  }

  async update(id: number, dto: ActualizarNovedadDto, idUsuario: number) {
    const novedad = await this.obtenerOFallar(id);
    if (dto.novedad !== undefined) {
      const nombre = capitalizarPalabras(dto.novedad);
      await this.validarNoDuplicado(nombre, id);
      novedad.novedad = nombre;
    }
    if (dto.descripcion !== undefined) {
      novedad.descripcion = dto.descripcion;
    }
    if (dto.estadoRegistro !== undefined) {
      novedad.estadoRegistro = dto.estadoRegistro;
    }
    novedad.idUsuario = idUsuario;
    await this.novedades.save(novedad);
    return { message: 'Novedad actualizada correctamente.', data: novedad };
  }

  async opciones() {
    const data = await this.novedades.find({
      where: { estadoRegistro: 1 },
      select: ['id', 'novedad'],
      order: { novedad: 'ASC' },
    });
    return { data };
  }

  async remove(id: number, idUsuario: number) {
    await this.obtenerOFallar(id);
    await this.novedades.update(id, { estadoRegistro: 0, idUsuario });
    await this.novedades.softDelete(id);
    return { message: 'Novedad eliminada correctamente.' };
  }

  private async validarNoDuplicado(nombre: string, idExcluido?: number): Promise<void> {
    const existente = await this.novedades.findOne({ where: { novedad: nombre } });
    if (existente && existente.id !== idExcluido) {
      throw new ConflictException({ title: TITULO, message: MENSAJE_DUPLICADO });
    }
  }

  private async obtenerOFallar(id: number): Promise<Novedad> {
    const novedad = await this.novedades.findOne({ where: { id } });
    if (!novedad) {
      throw new NotFoundException({ title: TITULO, message: 'Novedad no encontrada.' });
    }
    return novedad;
  }
}

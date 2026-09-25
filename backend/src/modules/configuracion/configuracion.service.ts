import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { asignarDefinidos } from '../../common/utils/asignar-definidos.util.js';
import { adjuntarResponsables } from '../../common/utils/responsable.util.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Configuracion } from './configuracion.entity.js';
import { CrearConfiguracionDto } from './dto/crear-configuracion.dto.js';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto.js';
import { NOMBRES_CONEXION_BD, exigirConexionBdValida } from './conexion-bd.util.js';
import { normalizarObjeto, ordenarObjeto } from './normalizar-objeto.util.js';

const TITULO = 'Configuración';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(Configuracion) private readonly configuraciones: Repository<Configuracion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  /** Crea una nueva versión — desactiva automáticamente la anterior con el mismo `nombre`. */
  async create(dto: CrearConfiguracionDto, idUsuario: number) {
    dto = { ...dto, objeto: normalizarObjeto(dto.nombre, dto.objeto) };
    exigirConexionBdValida(dto.nombre, dto.objeto, TITULO);
    await this.configuraciones.update(
      { nombre: dto.nombre, estadoRegistro: 1 },
      { estadoRegistro: 0, idUsuario },
    );

    const configuracion = await this.configuraciones.save(
      this.configuraciones.create({
        nombre: dto.nombre,
        alcance: dto.alcance,
        objeto: dto.objeto,
        idUsuario,
        descripcion: dto.descripcion ?? null,
        estadoRegistro: 1,
      }),
    );
    return { message: 'Configuración creada correctamente.', data: this.ordenada(configuracion) };
  }

  async findAll(query: PaginacionQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.configuraciones.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
    });
    return {
      data: await adjuntarResponsables(this.usuarios, data.map((configuracion) => this.ordenada(configuracion))),
      pagination: buildPaginationBlock(total, page, limit),
    };
  }

  async findOne(id: number) {
    const configuracion = await this.obtenerOFallar(id);
    return { data: this.ordenada(configuracion) };
  }

  async update(id: number, dto: ActualizarConfiguracionDto, idUsuario: number) {
    const configuracion = await this.obtenerOFallar(id);
    const nombre = dto.nombre ?? configuracion.nombre;
    if (dto.objeto !== undefined) {
      dto = { ...dto, objeto: normalizarObjeto(nombre, dto.objeto) };
    }
    exigirConexionBdValida(nombre, dto.objeto ?? configuracion.objeto, TITULO);
    asignarDefinidos(configuracion, dto);
    configuracion.idUsuario = idUsuario;
    await this.configuraciones.save(configuracion);
    return { message: 'Configuración actualizada correctamente.', data: this.ordenada(configuracion) };
  }

  async remove(id: number, idUsuario: number) {
    await this.obtenerOFallar(id);
    await this.configuraciones.update(id, { estadoRegistro: 0, idUsuario });
    await this.configuraciones.softDelete(id);
    return { message: 'Configuración eliminada correctamente.' };
  }

  /** Uso interno del backend (conexiones de Soporte, rate limit) — la fila activa con ese `nombre`, o null. */
  async obtenerActivaPorNombre(nombre: string): Promise<Record<string, unknown> | null> {
    const activa = await this.configuraciones.findOne({ where: { nombre, estadoRegistro: 1 } });
    return activa?.objeto ?? null;
  }

  /**
   * Opciones del select Motor de Soporte: pares `nombre`/`alcance` sin repetir de las
   * conexiones a BD activas (`rate_limit` y demás configuraciones no son motores).
   */
  async opcionesMotor(): Promise<{ nombre: string; alcance: string }[]> {
    return this.configuraciones
      .createQueryBuilder('configuracion')
      .select(['configuracion.nombre AS nombre', 'configuracion.alcance AS alcance'])
      .distinct(true)
      .where('configuracion.estadoRegistro = 1')
      .andWhere({ nombre: In(NOMBRES_CONEXION_BD) })
      .orderBy('configuracion.nombre', 'ASC')
      .addOrderBy('configuracion.alcance', 'ASC')
      .getRawMany<{ nombre: string; alcance: string }>();
  }

  /** Solo para la respuesta: MySQL guarda el JSON con otro orden de claves. */
  private ordenada(configuracion: Configuracion): Configuracion {
    configuracion.objeto = ordenarObjeto(configuracion.nombre, configuracion.objeto);
    return configuracion;
  }

  private async obtenerOFallar(id: number): Promise<Configuracion> {
    const configuracion = await this.configuraciones.findOne({ where: { id } });
    if (!configuracion) {
      throw new NotFoundException({ title: TITULO, message: 'Configuración no encontrada.' });
    }
    return configuracion;
  }
}

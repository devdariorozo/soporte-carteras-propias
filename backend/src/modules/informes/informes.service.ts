import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import ExcelJS from 'exceljs';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { EstadoSoporte, MotorSoporte, Soporte } from '../soporte/soporte.entity.js';
import { adjuntarResponsables, nombreCompleto } from '../../common/utils/responsable.util.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { FiltrosInformesDto } from './dto/filtros-informes.dto.js';

/** Mismo criterio que las tablas del frontend (pipe `vacio`): celda sin valor -> `---`. */
const TEXTO_VACIO = '---';

/** Igual que las opciones del select Motor en el frontend. */
const ETIQUETAS_MOTOR: Record<MotorSoporte, string> = {
  [MotorSoporte.MYSQL]: 'MySQL',
  [MotorSoporte.POSTGRES]: 'PostgreSQL',
};

function celda<T>(valor: T | null | undefined): T | string {
  return valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '') ? TEXTO_VACIO : valor;
}

interface RangoFechas {
  inicio: Date;
  fin: Date;
}

/** Colombia (COT) — desfase fijo, sin horario de verano. */
const ZONA_HORARIA_OFFSET = '-05:00';
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

@Injectable()
export class InformesService {
  constructor(
    @InjectRepository(Soporte) private readonly soportes: Repository<Soporte>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async listar(filtros: FiltrosInformesDto) {
    const page = filtros.page ?? DEFAULT_PAGE;
    const limit = filtros.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.construirConsulta(filtros)
      .orderBy('soporte.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: await adjuntarResponsables(this.usuarios, data), pagination: buildPaginationBlock(total, page, limit) };
  }

  /** Agrupa por estado_soporte sin aplicar el filtro de estado (ver planing/05-reglas-ui-ux.md). */
  async resumen(filtros: FiltrosInformesDto) {
    const filas = await this.construirConsulta(filtros, { conJoins: false, conFiltroEstado: false })
      .select('soporte.estadoSoporte', 'estado')
      .addSelect('COUNT(*)', 'total')
      .groupBy('soporte.estadoSoporte')
      .getRawMany<{ estado: EstadoSoporte; total: string }>();

    const conteos = Object.fromEntries(Object.values(EstadoSoporte).map((estado) => [estado, 0])) as Record<
      EstadoSoporte,
      number
    >;
    for (const fila of filas) {
      conteos[fila.estado] = Number(fila.total);
    }
    return { data: conteos };
  }

  /**
   * Opciones del filtro Usuario: solo quienes aparecen como responsables en `soporte`
   * (mismo universo que consulta el informe, incluidos los registros eliminados), no todos
   * los usuarios del sistema. Nombre completo con los 4 campos, ordenado alfabéticamente.
   */
  async opcionesUsuarios() {
    const filas = await this.soportes
      .createQueryBuilder('soporte')
      .withDeleted()
      .select('DISTINCT soporte.idUsuario', 'idUsuario')
      .where('soporte.idUsuario IS NOT NULL')
      .getRawMany<{ idUsuario: number }>();
    const ids = filas.map((fila) => Number(fila.idUsuario));
    const encontrados = ids.length ? await this.usuarios.find({ where: { id: In(ids) }, withDeleted: true }) : [];
    const data = encontrados
      .map((usuario) => ({ id: usuario.id, nombreCompleto: nombreCompleto(usuario) }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
    return { data };
  }

  async exportarExcel(filtros: FiltrosInformesDto): Promise<Buffer> {
    const registros = await adjuntarResponsables(
      this.usuarios,
      await this.construirConsulta(filtros).orderBy('soporte.id', 'DESC').getMany(),
    );

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Informes');
    hoja.columns = [
      { header: 'Número', key: 'numero', width: 10 },
      { header: 'Cliente', key: 'cliente', width: 25 },
      { header: 'Novedad', key: 'novedad', width: 25 },
      { header: 'Mensaje WhatsApp', key: 'mensajeWhatsapp', width: 45 },
      { header: 'Motor', key: 'motor', width: 12 },
      { header: 'Sentencia', key: 'sentencia', width: 45 },
      { header: 'Estado soporte', key: 'estadoSoporte', width: 15 },
      { header: 'Estado registro', key: 'estadoRegistro', width: 14 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Responsable', key: 'responsable', width: 25 },
      { header: 'Fecha creación', key: 'fechaCreacion', width: 20 },
      { header: 'Fecha actualización', key: 'fechaActualizacion', width: 20 },
    ];
    for (const registro of registros) {
      hoja.addRow({
        numero: registro.id,
        cliente: celda(registro.cliente),
        novedad: celda(registro.novedadRef?.novedad),
        mensajeWhatsapp: celda(registro.mensajeWhatsapp),
        motor: celda(ETIQUETAS_MOTOR[registro.motor]),
        sentencia: celda(registro.sentencia),
        estadoSoporte: celda(registro.estadoSoporte),
        estadoRegistro: registro.estadoRegistro === 1 ? 'Activo' : 'Inactivo',
        descripcion: celda(registro.descripcion),
        responsable: celda(registro.responsable),
        fechaCreacion: celda(registro.fechaCreacion),
        fechaActualizacion: celda(registro.fechaActualizacion),
      });
    }

    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  private construirConsulta(
    filtros: FiltrosInformesDto,
    opciones: { conJoins?: boolean; conFiltroEstado?: boolean } = {},
  ): SelectQueryBuilder<Soporte> {
    const { conJoins = true, conFiltroEstado = true } = opciones;
    const qb = this.soportes.createQueryBuilder('soporte').withDeleted();
    if (conJoins) {
      qb.leftJoinAndSelect('soporte.novedadRef', 'novedad');
    }

    const { inicio, fin } = this.resolverRangoFechas(filtros.fechaInicio, filtros.fechaFin);
    qb.andWhere('soporte.fechaCreacion BETWEEN :inicio AND :fin', { inicio, fin });

    if (filtros.idNovedad?.length) {
      qb.andWhere('soporte.idNovedad IN (:...idNovedad)', { idNovedad: filtros.idNovedad });
    }
    if (filtros.idUsuario?.length) {
      qb.andWhere('soporte.idUsuario IN (:...idUsuario)', { idUsuario: filtros.idUsuario });
    }
    if (conFiltroEstado && filtros.estadoSoporte?.length) {
      qb.andWhere('soporte.estadoSoporte IN (:...estados)', { estados: filtros.estadoSoporte });
    }

    return qb;
  }

  private resolverRangoFechas(fechaInicio?: string, fechaFin?: string): RangoFechas {
    const desde = fechaInicio ?? fechaFin ?? this.fechaHoyBogota();
    const hasta = fechaFin ?? fechaInicio ?? desde;
    return {
      inicio: new Date(`${desde}T00:00:00${ZONA_HORARIA_OFFSET}`),
      fin: new Date(`${hasta}T23:59:59.999${ZONA_HORARIA_OFFSET}`),
    };
  }

  /**
   * El servidor corre en UTC (Docker) pero el usuario opera en Colombia (UTC-5, sin
   * horario de verano) — "hoy" sin filtros debe ser el día calendario en Bogotá, no en
   * UTC, o un registro creado de noche queda fuera del rango por defecto.
   */
  private fechaHoyBogota(): string {
    const instanteBogota = new Date(Date.now() + BOGOTA_OFFSET_MS);
    return instanteBogota.toISOString().slice(0, 10);
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { EstadoSoporte, Soporte } from '../soporte/soporte.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { nombreCompleto } from '../../common/utils/responsable.util.js';
import { resolverRangoFechas } from '../../common/utils/rango-fechas.util.js';
import { FiltrosTableroDto } from './dto/filtros-tablero.dto.js';
import {
  MAX_DIAS_RANGO,
  RangoDias,
  diasDelRango,
  periodoAnterior,
  porcentaje,
  resolverRangoTablero,
  tasaExito,
  variacion,
} from './tablero.calculos.js';

const TITULO = 'Tablero';
const TOP_NOVEDADES = 10;
const SIN_RESPONSABLE = 'Sin responsable';

interface ConteosCrudos {
  total: string | null;
  completados: string | null;
  errores: string | null;
}

interface Conteos {
  total: number;
  completados: number;
  errores: number;
  pendientes: number;
}

function aConteos(fila: ConteosCrudos | undefined): Conteos {
  const total = Number(fila?.total ?? 0);
  const completados = Number(fila?.completados ?? 0);
  const errores = Number(fila?.errores ?? 0);
  return { total, completados, errores, pendientes: total - completados - errores };
}

@Injectable()
export class TableroService {
  constructor(
    @InjectRepository(Soporte) private readonly soportes: Repository<Soporte>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async kpis(filtros: FiltrosTableroDto) {
    const rango = this.validarRango(filtros);
    const anterior = periodoAnterior(rango);

    const [actual, filaAnterior, filasIntegrantes, filasNovedades] = await Promise.all([
      this.conConteos(this.consulta(filtros, rango)).getRawOne<ConteosCrudos>(),
      this.consulta(filtros, anterior).select('COUNT(*)', 'total').getRawOne<{ total: string }>(),
      this.conConteos(this.consulta(filtros, rango))
        .addSelect('soporte.idUsuario', 'idUsuario')
        .groupBy('soporte.idUsuario')
        .orderBy('total', 'DESC')
        .addOrderBy('soporte.idUsuario', 'ASC')
        .getRawMany<ConteosCrudos & { idUsuario: number | null }>(),
      this.conConteos(this.consulta(filtros, rango))
        .innerJoin('soporte.novedadRef', 'novedad')
        .addSelect('soporte.idNovedad', 'idNovedad')
        .addSelect('novedad.novedad', 'novedad')
        .groupBy('soporte.idNovedad')
        .addGroupBy('novedad.novedad')
        .orderBy('total', 'DESC')
        .addOrderBy('errores', 'DESC')
        .addOrderBy('novedad.novedad', 'ASC')
        .limit(TOP_NOVEDADES)
        .getRawMany<ConteosCrudos & { idNovedad: number; novedad: string }>(),
    ]);

    const resumen = aConteos(actual);
    const totalPeriodoAnterior = Number(filaAnterior?.total ?? 0);
    const topNovedades = filasNovedades.map((fila) => {
      const conteos = aConteos(fila);
      return {
        idNovedad: Number(fila.idNovedad),
        novedad: fila.novedad,
        total: conteos.total,
        errores: conteos.errores,
        porcentajeError: porcentaje(conteos.errores, conteos.total),
      };
    });

    return {
      data: {
        rango,
        resumen: {
          ...resumen,
          tasaExito: tasaExito(resumen.completados, resumen.errores),
          totalPeriodoAnterior,
          variacionTotal: variacion(resumen.total, totalPeriodoAnterior),
        },
        porIntegrante: await this.nombrarIntegrantes(filasIntegrantes),
        topNovedades,
        concentracionTop10: porcentaje(
          topNovedades.reduce((suma, fila) => suma + fila.total, 0),
          resumen.total,
        ),
      },
    };
  }

  private validarRango(filtros: FiltrosTableroDto): RangoDias {
    const rango = resolverRangoTablero(filtros.fechaInicio, filtros.fechaFin);
    if (rango.fechaInicio > rango.fechaFin) {
      throw new BadRequestException({ title: TITULO, message: 'La fecha inicial no puede ser mayor que la fecha final.' });
    }
    if (diasDelRango(rango) > MAX_DIAS_RANGO) {
      throw new BadRequestException({ title: TITULO, message: `El rango no puede superar ${MAX_DIAS_RANGO} días.` });
    }
    return rango;
  }

  /** Mismo universo que Informe: incluye los registros eliminados. */
  private consulta(filtros: FiltrosTableroDto, rango: RangoDias): SelectQueryBuilder<Soporte> {
    const { inicio, fin } = resolverRangoFechas(rango.fechaInicio, rango.fechaFin);
    const qb = this.soportes
      .createQueryBuilder('soporte')
      .withDeleted()
      .where('soporte.fechaCreacion BETWEEN :inicio AND :fin', { inicio, fin });

    if (filtros.idUsuario?.length) {
      qb.andWhere('soporte.idUsuario IN (:...idUsuario)', { idUsuario: filtros.idUsuario });
    }
    if (filtros.motor?.length) {
      qb.andWhere('soporte.motor IN (:...motor)', { motor: filtros.motor });
    }
    if (filtros.idNovedad?.length) {
      qb.andWhere('soporte.idNovedad IN (:...idNovedad)', { idNovedad: filtros.idNovedad });
    }
    return qb;
  }

  private conConteos(qb: SelectQueryBuilder<Soporte>): SelectQueryBuilder<Soporte> {
    return qb
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN soporte.estadoSoporte = :completado THEN 1 ELSE 0 END)', 'completados')
      .addSelect('SUM(CASE WHEN soporte.estadoSoporte = :error THEN 1 ELSE 0 END)', 'errores')
      .setParameters({ completado: EstadoSoporte.COMPLETADO, error: EstadoSoporte.ERROR });
  }

  private async nombrarIntegrantes(filas: (ConteosCrudos & { idUsuario: number | null })[]) {
    const ids = filas.map((fila) => fila.idUsuario).filter((id): id is number => id !== null);
    const encontrados = ids.length ? await this.usuarios.find({ where: { id: In(ids) }, withDeleted: true }) : [];
    const nombres = new Map(encontrados.map((usuario) => [usuario.id, nombreCompleto(usuario)]));

    return filas.map((fila) => {
      const idUsuario = fila.idUsuario === null ? null : Number(fila.idUsuario);
      const conteos = aConteos(fila);
      return {
        idUsuario,
        nombre: (idUsuario !== null && nombres.get(idUsuario)) || SIN_RESPONSABLE,
        ...conteos,
        tasaExito: tasaExito(conteos.completados, conteos.errores),
      };
    });
  }
}

import { fechaHoyBogota } from '../../common/utils/rango-fechas.util.js';

/** Rango máximo que admite el tablero (un año, bisiesto incluido). */
export const MAX_DIAS_RANGO = 366;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface RangoDias {
  fechaInicio: string;
  fechaFin: string;
}

/** `parte / base × 100` redondeado a 1 decimal; `null` si la base es 0 (en pantalla, "—" y no 0 %). */
export function porcentaje(parte: number, base: number): number | null {
  return base > 0 ? Math.round((parte / base) * 1000) / 10 : null;
}

/** Tasa de éxito: `Creado` y `En proceso` no tienen resultado todavía, no entran en la base. */
export function tasaExito(completados: number, errores: number): number | null {
  return porcentaje(completados, completados + errores);
}

/** Variación % del total contra el periodo anterior; `null` si el anterior es 0 (no hay contra qué comparar). */
export function variacion(actual: number, anterior: number): number | null {
  return anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null;
}

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Días calendario del rango, ambos extremos incluidos. */
export function diasDelRango({ fechaInicio, fechaFin }: RangoDias): number {
  return Math.round((Date.parse(`${fechaFin}T00:00:00Z`) - Date.parse(`${fechaInicio}T00:00:00Z`)) / MS_POR_DIA) + 1;
}

/**
 * Sin fechas: mes actual (del día 1 a hoy, en Bogotá). Con una sola fecha, el rango es ese día
 * (mismo criterio que Informe).
 */
export function resolverRangoTablero(fechaInicio?: string, fechaFin?: string, hoy = fechaHoyBogota()): RangoDias {
  if (!fechaInicio && !fechaFin) {
    return { fechaInicio: `${hoy.slice(0, 7)}-01`, fechaFin: hoy };
  }
  const desde = fechaInicio ?? fechaFin!;
  return { fechaInicio: desde, fechaFin: fechaFin ?? desde };
}

/** Periodo inmediatamente anterior con la misma cantidad de días. */
export function periodoAnterior(rango: RangoDias): RangoDias {
  const dias = diasDelRango(rango);
  const fechaFin = sumarDias(rango.fechaInicio, -1);
  return { fechaInicio: sumarDias(fechaFin, -(dias - 1)), fechaFin };
}

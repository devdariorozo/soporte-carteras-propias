/** Colombia (COT) — desfase fijo, sin horario de verano. */
export const ZONA_HORARIA_OFFSET = '-05:00';
export const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

export interface RangoFechas {
  inicio: Date;
  fin: Date;
}

/**
 * El servidor corre en UTC (Docker) pero el usuario opera en Colombia (UTC-5, sin
 * horario de verano) — "hoy" sin filtros debe ser el día calendario en Bogotá, no en
 * UTC, o un registro creado de noche queda fuera del rango por defecto.
 */
export function fechaHoyBogota(): string {
  const instanteBogota = new Date(Date.now() + BOGOTA_OFFSET_MS);
  return instanteBogota.toISOString().slice(0, 10);
}

/** Días calendario YYYY-MM-DD (inclusive) -> instantes en hora Colombia. Con una sola fecha, el rango es ese día. */
export function resolverRangoFechas(fechaInicio?: string, fechaFin?: string): RangoFechas {
  const desde = fechaInicio ?? fechaFin ?? fechaHoyBogota();
  const hasta = fechaFin ?? fechaInicio ?? desde;
  return {
    inicio: new Date(`${desde}T00:00:00${ZONA_HORARIA_OFFSET}`),
    fin: new Date(`${hasta}T23:59:59.999${ZONA_HORARIA_OFFSET}`),
  };
}

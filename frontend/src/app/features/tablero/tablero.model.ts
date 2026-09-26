/** Contrato de `GET /api/tablero/kpis` (ver docs/15-tablero.md). */
export interface ResumenTablero {
  total: number;
  completados: number;
  errores: number;
  pendientes: number;
  /** `null` si no hay completados ni errores (se muestra "—"). */
  tasaExito: number | null;
  totalPeriodoAnterior: number;
  /** `null` si el periodo anterior no tiene soportes. */
  variacionTotal: number | null;
}

export interface KpiIntegrante {
  idUsuario: number | null;
  nombre: string;
  total: number;
  completados: number;
  errores: number;
  pendientes: number;
  tasaExito: number | null;
}

export interface KpiNovedad {
  idNovedad: number;
  novedad: string;
  total: number;
  errores: number;
  porcentajeError: number | null;
}

export interface KpisTablero {
  rango: { fechaInicio: string; fechaFin: string };
  resumen: ResumenTablero;
  porIntegrante: KpiIntegrante[];
  topNovedades: KpiNovedad[];
  concentracionTop10: number | null;
}

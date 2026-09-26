import { construirParams } from './tablero.service';
import { formatearFecha, rangoAtajo } from './tablero.component';
import { altoGrafico, colorExito, COLORES, formatearNumero, formatearPorcentaje } from './tablero.graficos';

describe('Tablero', () => {
  it('construye los parámetros con arreglos repetidos y omite los vacíos', () => {
    const params = construirParams({
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-26',
      idUsuario: [3, 5],
      motor: ['mysql'],
      idNovedad: [],
    });
    expect(params.get('fechaInicio')).toBe('2026-09-01');
    expect(params.getAll('idUsuario')).toEqual(['3', '5']);
    expect(params.getAll('motor')).toEqual(['mysql']);
    expect(params.has('idNovedad')).toBe(false);
  });

  it('tasa sin base se muestra "—", nunca 0 %', () => {
    expect(formatearPorcentaje(null)).toBe('—');
    expect(formatearPorcentaje(92.1)).toBe('92 %');
    expect(formatearPorcentaje(92.6)).toBe('93 %');
    expect(formatearNumero(1284)).toBe('1.284');
  });

  it('color del éxito según la meta', () => {
    expect(colorExito(null)).toBe(COLORES.pendiente);
    expect(colorExito(70)).toBe(COLORES.error);
    expect(colorExito(90)).toBe(COLORES.alerta);
    expect(colorExito(95)).toBe(COLORES.completado);
  });

  it('atajos de rango', () => {
    const hoy = new Date(2026, 8, 26);
    expect(rangoAtajo('mes', hoy).map(formatearFecha)).toEqual(['2026-09-01', '2026-09-26']);
    expect(rangoAtajo('7dias', hoy).map(formatearFecha)).toEqual(['2026-09-20', '2026-09-26']);
    expect(rangoAtajo('mesAnterior', hoy).map(formatearFecha)).toEqual(['2026-08-01', '2026-08-31']);
    expect(rangoAtajo('hoy', new Date(2026, 0, 1)).map(formatearFecha)).toEqual(['2026-01-01', '2026-01-01']);
  });

  it('alto dinámico del gráfico', () => {
    expect(altoGrafico(0)).toBe(220);
    expect(altoGrafico(20)).toBe(700);
  });
});

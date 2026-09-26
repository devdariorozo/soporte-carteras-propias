import { describe, expect, it } from 'vitest';
import { diasDelRango, periodoAnterior, porcentaje, resolverRangoTablero, tasaExito, variacion } from './tablero.calculos.js';

describe('tablero.calculos', () => {
  it('tasa de éxito excluye pendientes y es null con base 0', () => {
    expect(tasaExito(1150, 98)).toBe(92.1);
    expect(tasaExito(0, 0)).toBeNull();
    expect(tasaExito(0, 5)).toBe(0);
  });

  it('porcentaje redondea a 1 decimal', () => {
    expect(porcentaje(1, 3)).toBe(33.3);
    expect(porcentaje(2, 3)).toBe(66.7);
    expect(porcentaje(5, 0)).toBeNull();
  });

  it('variación contra el periodo anterior', () => {
    expect(variacion(1284, 1146)).toBe(12);
    expect(variacion(80, 100)).toBe(-20);
    expect(variacion(10, 0)).toBeNull();
  });

  it('sin fechas usa el mes actual; con una sola fecha, ese día', () => {
    expect(resolverRangoTablero(undefined, undefined, '2026-09-26')).toEqual({ fechaInicio: '2026-09-01', fechaFin: '2026-09-26' });
    expect(resolverRangoTablero('2026-09-10')).toEqual({ fechaInicio: '2026-09-10', fechaFin: '2026-09-10' });
    expect(resolverRangoTablero(undefined, '2026-09-10')).toEqual({ fechaInicio: '2026-09-10', fechaFin: '2026-09-10' });
  });

  it('periodo anterior de igual duración, inmediatamente antes', () => {
    expect(periodoAnterior({ fechaInicio: '2026-09-01', fechaFin: '2026-09-26' })).toEqual({
      fechaInicio: '2026-08-06',
      fechaFin: '2026-08-31',
    });
    expect(periodoAnterior({ fechaInicio: '2026-03-01', fechaFin: '2026-03-01' })).toEqual({
      fechaInicio: '2026-02-28',
      fechaFin: '2026-02-28',
    });
    expect(diasDelRango({ fechaInicio: '2026-01-01', fechaFin: '2026-12-31' })).toBe(365);
  });
});

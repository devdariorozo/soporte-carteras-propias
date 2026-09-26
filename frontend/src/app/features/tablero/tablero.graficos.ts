import type { EChartsCoreOption } from 'echarts/core';
import { KpiIntegrante, KpiNovedad } from './tablero.model';

/** Meta de la tasa de éxito y umbrales del gauge (rojo < 80, ámbar < 95, verde ≥ 95). */
export const META_EXITO = 95;
const UMBRAL_ROJO = 80;

/** Novedad en alerta (chip rojo) cuando su % de error supera este valor. */
export const UMBRAL_ERROR_NOVEDAD = 10;

/** Mismos colores de estado que las tarjetas de Informe. */
export const COLORES = {
  completado: '#22c55e',
  error: '#ef4444',
  pendiente: '#94a3b8',
  alerta: '#f59e0b',
  primario: '#10b981',
  texto: '#334155',
  textoSuave: '#64748b',
  linea: '#e2e8f0',
};

const MEDALLAS = ['🥇', '🥈', '🥉'];
const ALTO_BARRA = 32;
const ALTO_MINIMO = 220;

const numero = new Intl.NumberFormat('es-CO');
const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function formatearNumero(valor: number): string {
  return numero.format(valor);
}

/** Porcentaje en entero (92,6 -> "93 %"); `null` -> "—" (sin base para calcular), nunca "0 %". */
export function formatearPorcentaje(valor: number | null): string {
  return valor === null ? '—' : `${entero.format(valor)} %`;
}

/** Alto del gráfico según la cantidad de barras, para que las etiquetas no se aplasten. */
export function altoGrafico(barras: number): number {
  return Math.max(ALTO_MINIMO, barras * ALTO_BARRA + 60);
}

/** Evalúa la tasa redondeada, igual que se muestra: "95 %" nunca sale en ámbar. */
export function colorExito(tasa: number | null): string {
  if (tasa === null) return COLORES.pendiente;
  tasa = Math.round(tasa);
  if (tasa < UMBRAL_ROJO) return COLORES.error;
  if (tasa < META_EXITO) return COLORES.alerta;
  return COLORES.completado;
}

function recortar(texto: string, largo = 28): string {
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}

const EJE_CATEGORIAS = {
  type: 'category',
  inverse: true,
  axisTick: { show: false },
  axisLine: { show: false },
  axisLabel: { color: COLORES.texto, fontSize: 12 },
};

const EJE_VALORES = {
  type: 'value',
  minInterval: 1,
  splitLine: { lineStyle: { color: COLORES.linea } },
  axisLabel: { color: COLORES.textoSuave },
};

/**
 * Serie "fantasma" del mismo largo que la barra apilada (barGap -100 %): no se ve, solo pone
 * a la derecha la etiqueta con el total y el porcentaje.
 */
function serieEtiqueta(totales: number[], formatter: (indice: number) => string) {
  return {
    name: 'Total',
    type: 'bar',
    barGap: '-100%',
    barWidth: 18,
    data: totales,
    silent: true,
    z: -1,
    itemStyle: { color: 'transparent' },
    tooltip: { show: false },
    label: {
      show: true,
      position: 'right',
      color: COLORES.texto,
      fontWeight: 600,
      formatter: ({ dataIndex }: { dataIndex: number }) => formatter(dataIndex),
      rich: { alerta: { color: COLORES.error, fontWeight: 700 } },
    },
  };
}

function tooltip(filas: string[][]) {
  return filas.map(([etiqueta, valor]) => `${etiqueta}: <b>${valor}</b>`).join('<br/>');
}

export function opcionesRanking(integrantes: KpiIntegrante[]): EChartsCoreOption {
  const barra = { type: 'bar', stack: 'estado', barWidth: 18 };
  return {
    aria: { enabled: true },
    grid: { left: 8, right: 120, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, data: ['Completado', 'Error', 'Pendiente'], textStyle: { color: COLORES.textoSuave } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: { dataIndex: number }[]) => {
        const fila = integrantes[params[0].dataIndex];
        return `<b>${fila.nombre}</b><br/>${tooltip([
          ['Total', formatearNumero(fila.total)],
          ['Completados', formatearNumero(fila.completados)],
          ['Con error', formatearNumero(fila.errores)],
          ['Pendientes', formatearNumero(fila.pendientes)],
          ['Tasa de éxito', formatearPorcentaje(fila.tasaExito)],
        ])}`;
      },
    },
    xAxis: EJE_VALORES,
    yAxis: {
      ...EJE_CATEGORIAS,
      data: integrantes.map((fila, i) => `${MEDALLAS[i] ?? `${i + 1}.`} ${recortar(fila.nombre)}`),
    },
    series: [
      { ...barra, name: 'Completado', data: integrantes.map((f) => f.completados), itemStyle: { color: COLORES.completado } },
      { ...barra, name: 'Error', data: integrantes.map((f) => f.errores), itemStyle: { color: COLORES.error } },
      {
        ...barra,
        name: 'Pendiente',
        data: integrantes.map((f) => f.pendientes),
        itemStyle: { color: COLORES.pendiente, borderRadius: [0, 4, 4, 0] },
      },
      serieEtiqueta(
        integrantes.map((f) => f.total),
        (i) => `${formatearNumero(integrantes[i].total)} · ${formatearPorcentaje(integrantes[i].tasaExito)} éxito`,
      ),
    ],
  };
}

export function opcionesTopNovedades(novedades: KpiNovedad[]): EChartsCoreOption {
  const barra = { type: 'bar', stack: 'novedad', barWidth: 18 };
  return {
    aria: { enabled: true },
    grid: { left: 8, right: 150, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, data: ['Sin error', 'Con error'], textStyle: { color: COLORES.textoSuave } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: { dataIndex: number }[]) => {
        const fila = novedades[params[0].dataIndex];
        return `<b>${fila.novedad}</b><br/>${tooltip([
          ['Soportes', formatearNumero(fila.total)],
          ['Con error', formatearNumero(fila.errores)],
          ['% de error', formatearPorcentaje(fila.porcentajeError)],
        ])}`;
      },
    },
    xAxis: EJE_VALORES,
    yAxis: { ...EJE_CATEGORIAS, data: novedades.map((f, i) => `${i + 1}. ${recortar(f.novedad)}`) },
    series: [
      { ...barra, name: 'Sin error', data: novedades.map((f) => f.total - f.errores), itemStyle: { color: COLORES.primario } },
      {
        ...barra,
        name: 'Con error',
        data: novedades.map((f) => f.errores),
        itemStyle: { color: COLORES.error, borderRadius: [0, 4, 4, 0] },
      },
      serieEtiqueta(
        novedades.map((f) => f.total),
        (i) => {
          const fila = novedades[i];
          const error = `${formatearPorcentaje(fila.porcentajeError)} error`;
          const enAlerta = (fila.porcentajeError ?? 0) > UMBRAL_ERROR_NOVEDAD;
          return `${formatearNumero(fila.total)} · ${enAlerta ? `{alerta|${error} ●}` : error}`;
        },
      ),
    ],
  };
}

export function opcionesGauge(tasa: number | null): EChartsCoreOption {
  return {
    aria: { enabled: true },
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        startAngle: 200,
        endAngle: -20,
        radius: '120%',
        center: ['50%', '70%'],
        progress: { show: true, width: 9, itemStyle: { color: colorExito(tasa) } },
        axisLine: {
          lineStyle: {
            width: 9,
            color: [
              [UMBRAL_ROJO / 100, '#fee2e2'],
              [META_EXITO / 100, '#fef3c7'],
              [1, '#dcfce7'],
            ],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-15%'],
          fontSize: 16,
          fontWeight: 700,
          color: colorExito(tasa),
          formatter: () => formatearPorcentaje(tasa),
        },
        data: [{ value: tasa ?? 0 }],
      },
    ],
  };
}

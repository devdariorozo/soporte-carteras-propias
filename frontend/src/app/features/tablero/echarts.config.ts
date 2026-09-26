// Solo lo que usa el Tablero (tree-shaking): barras horizontales, gauge y canvas.
import * as echarts from 'echarts/core';
import { BarChart, GaugeChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, GaugeChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export { echarts };

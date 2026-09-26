import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ButtonModule } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { MultiSelect } from 'primeng/multiselect';
import { Chip } from 'primeng/chip';
import { PermisosService } from '../../core/services/permisos.service';
import { LoadingService } from '../../core/services/loading.service';
import { ToastService } from '../../core/services/toast.service';
import { MOTORES, MotorSoporte } from '../../core/utils/motor.util';
import { FiltrosTablero, OpcionIntegrante, TableroService } from './tablero.service';
import { KpisTablero } from './tablero.model';
import {
  META_EXITO,
  altoGrafico,
  colorExito,
  formatearNumero,
  formatearPorcentaje,
  opcionesGauge,
  opcionesRanking,
  opcionesTopNovedades,
} from './tablero.graficos';

const MODULO = 'Tablero';

type Atajo = 'hoy' | '7dias' | 'mes' | 'mesAnterior';

/** Rangos rápidos, en la fecha local del navegador (el equipo opera en Colombia). */
export function rangoAtajo(atajo: Atajo, hoy = new Date()): [Date, Date] {
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const d = hoy.getDate();
  switch (atajo) {
    case 'hoy':
      return [new Date(y, m, d), new Date(y, m, d)];
    case '7dias':
      return [new Date(y, m, d - 6), new Date(y, m, d)];
    case 'mes':
      return [new Date(y, m, 1), new Date(y, m, d)];
    case 'mesAnterior':
      return [new Date(y, m - 1, 1), new Date(y, m, 0)];
  }
}

export function formatearFecha(fecha: Date): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

@Component({
  selector: 'app-tablero',
  imports: [FormsModule, ButtonModule, DatePicker, MultiSelect, Chip, NgxEchartsDirective],
  // ECharts se carga solo al entrar al Tablero (import dinámico, fuera del bundle inicial).
  providers: [provideEchartsCore({ echarts: () => import('./echarts.config').then((m) => m.echarts) })],
  templateUrl: './tablero.component.html',
})
export class TableroComponent implements OnInit {
  protected readonly formatearNumero = formatearNumero;
  protected readonly formatearPorcentaje = formatearPorcentaje;
  protected readonly colorExito = colorExito;
  protected readonly metaExito = META_EXITO;
  protected readonly motores = MOTORES;
  protected readonly atajos: { etiqueta: string; valor: Atajo }[] = [
    { etiqueta: 'Hoy', valor: 'hoy' },
    { etiqueta: '7 días', valor: '7dias' },
    { etiqueta: 'Mes actual', valor: 'mes' },
    { etiqueta: 'Mes anterior', valor: 'mesAnterior' },
  ];

  private readonly tableroService = inject(TableroService);
  private readonly permisosService = inject(PermisosService);
  private readonly loadingService = inject(LoadingService);
  private readonly toastService = inject(ToastService);

  readonly puedeConsultar = computed(() => this.permisosService.tiene(MODULO, 'Consultar'));

  readonly rangoFechas = signal<Date[] | null>(rangoAtajo('mes'));
  readonly filtroUsuario = signal<number[]>([]);
  readonly filtroMotor = signal<MotorSoporte[]>([]);
  /** Filtro cruzado: se fija al hacer clic en una barra del top 10. */
  readonly filtroNovedad = signal<{ id: number; novedad: string } | null>(null);

  readonly integrantes = signal<OpcionIntegrante[]>([]);
  readonly kpis = signal<KpisTablero | null>(null);

  readonly sinDatos = computed(() => this.kpis()?.resumen.total === 0);
  readonly opcionesRanking = computed(() => opcionesRanking(this.kpis()?.porIntegrante ?? []));
  readonly opcionesNovedades = computed(() => opcionesTopNovedades(this.kpis()?.topNovedades ?? []));
  readonly opcionesGauge = computed(() => opcionesGauge(this.kpis()?.resumen.tasaExito ?? null));
  readonly altoRanking = computed(() => altoGrafico(this.kpis()?.porIntegrante.length ?? 0));
  readonly altoNovedades = computed(() => altoGrafico(this.kpis()?.topNovedades.length ?? 0));

  ngOnInit(): void {
    void this.cargarIntegrantes();
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.loadingService.show('Cargando tablero...');
    try {
      const respuesta = await firstValueFrom(this.tableroService.kpis(this.filtros()));
      this.kpis.set(respuesta.data);
    } catch {
      this.toastService.error('No se pudo cargar el tablero.');
    } finally {
      this.loadingService.hide();
    }
  }

  /** El datepicker de rango emite al elegir la primera fecha: solo recarga con el rango completo. */
  onRangoCerrado(): void {
    const [inicio, fin] = this.rangoFechas() ?? [];
    if (inicio && !fin) {
      this.rangoFechas.set([inicio, inicio]);
    }
    void this.cargar();
  }

  aplicarAtajo(atajo: Atajo): void {
    this.rangoFechas.set(rangoAtajo(atajo));
    void this.cargar();
  }

  onFiltroChange(): void {
    void this.cargar();
  }

  limpiar(): void {
    this.rangoFechas.set(rangoAtajo('mes'));
    this.filtroUsuario.set([]);
    this.filtroMotor.set([]);
    this.filtroNovedad.set(null);
    void this.cargar();
  }

  quitarFiltroNovedad(): void {
    this.filtroNovedad.set(null);
    void this.cargar();
  }

  /** Clic en un integrante del ranking: el tablero se recalcula solo con él. */
  onClicIntegrante({ dataIndex }: { dataIndex: number }): void {
    const idUsuario = this.kpis()?.porIntegrante[dataIndex]?.idUsuario;
    if (idUsuario === null || idUsuario === undefined) return;
    this.filtroUsuario.set([idUsuario]);
    void this.cargar();
  }

  /** Clic en una novedad del top 10: el tablero se recalcula solo con ella. */
  onClicNovedad({ dataIndex }: { dataIndex: number }): void {
    const fila = this.kpis()?.topNovedades[dataIndex];
    if (!fila) return;
    this.filtroNovedad.set({ id: fila.idNovedad, novedad: fila.novedad });
    void this.cargar();
  }

  filtros(): FiltrosTablero {
    const [inicio, fin] = this.rangoFechas() ?? [];
    return {
      fechaInicio: inicio ? formatearFecha(inicio) : null,
      fechaFin: (fin ?? inicio) ? formatearFecha((fin ?? inicio)!) : null,
      idUsuario: this.filtroUsuario(),
      motor: this.filtroMotor(),
      idNovedad: this.filtroNovedad() ? [this.filtroNovedad()!.id] : [],
    };
  }

  /** Participación de un estado en el total (subtítulo de las tarjetas). */
  participacion(valor: number): string {
    const total = this.kpis()?.resumen.total ?? 0;
    return formatearPorcentaje(total > 0 ? Math.round((valor / total) * 1000) / 10 : null);
  }

  private async cargarIntegrantes(): Promise<void> {
    try {
      const respuesta = await firstValueFrom(this.tableroService.integrantes());
      this.integrantes.set(respuesta.data ?? []);
    } catch {
      this.integrantes.set([]);
    }
  }
}

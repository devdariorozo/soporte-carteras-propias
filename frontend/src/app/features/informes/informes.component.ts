import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';
import { DatePicker } from 'primeng/datepicker';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { PermisosService } from '../../core/services/permisos.service';
import { LoadingService } from '../../core/services/loading.service';
import { ToastService } from '../../core/services/toast.service';
import { ResponseEnvelope } from '../../core/envelope.model';
import { VacioPipe } from '../../shared/pipes/vacio.pipe';
import { etiquetaMotor } from '../../core/utils/motor.util';
import { copiarTexto } from '../../core/utils/portapapeles.util';
import { TablaResponsivaDirective } from '../../shared/directives/tabla-responsiva.directive';

const MODULO = 'Informe';

export type EstadoSoporte = 'Creado' | 'En proceso' | 'Completado' | 'Error';
const ESTADOS: EstadoSoporte[] = ['Creado', 'En proceso', 'Completado', 'Error'];

export interface OpcionNovedad {
  id: number;
  novedad: string;
}

export interface OpcionUsuario {
  id: number;
  nombreCompleto: string;
}

export interface RegistroInforme {
  id: number;
  cliente: string;
  mensajeWhatsapp: string;
  motor: string;
  sentencia: string;
  estadoSoporte: EstadoSoporte;
  estadoRegistro: number;
  descripcion: string | null;
  responsable: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  novedadRef?: OpcionNovedad;
}

type ResumenPorEstado = Record<EstadoSoporte, number>;

const COLORES_ESTADO: Record<EstadoSoporte, string> = {
  Creado: '#64748b',
  'En proceso': '#f59e0b',
  Completado: '#22c55e',
  Error: '#ef4444',
};

/** Etiqueta de estado en la fila (mismo criterio de color que las tarjetas de resumen). */
const SEVERIDAD_ESTADO: Record<EstadoSoporte, 'success' | 'danger' | 'warn' | 'secondary'> = {
  Creado: 'secondary',
  'En proceso': 'warn',
  Completado: 'success',
  Error: 'danger',
};

/** Descripción en el detalle de la fila: ícono y línea lateral del color del estado (sin fondos). */
const ESTILO_RESULTADO: Record<EstadoSoporte, { icono: string; borde: string }> = {
  Completado: { icono: 'pi-check-circle text-green-600', borde: 'border-green-500' },
  Error: { icono: 'pi-times-circle text-red-600', borde: 'border-red-500' },
  'En proceso': { icono: 'pi-exclamation-triangle text-yellow-600', borde: 'border-yellow-500' },
  Creado: { icono: 'pi-info-circle text-surface-500', borde: 'border-surface-300' },
};

const LARGO_VISTA_PREVIA = 300;

const ICONOS_ESTADO: Record<EstadoSoporte, string> = {
  Creado: 'pi-shopping-cart',
  'En proceso': 'pi-truck',
  Completado: 'pi-check-circle',
  Error: 'pi-times-circle',
};

@Component({
  selector: 'app-informes',
  imports: [TableModule, ButtonModule, MultiSelect, DatePicker, Tag, Tooltip, FormsModule, DatePipe, VacioPipe, TablaResponsivaDirective],
  templateUrl: './informes.component.html',
})
export class InformesComponent implements OnInit {
  protected readonly etiquetaMotor = etiquetaMotor;

  private readonly http = inject(HttpClient);
  private readonly permisosService = inject(PermisosService);
  private readonly loadingService = inject(LoadingService);
  private readonly toastService = inject(ToastService);

  readonly puedeConsultar = computed(() => this.permisosService.tiene(MODULO, 'Consultar'));

  readonly rows = 10;
  readonly registros = signal<RegistroInforme[]>([]);
  readonly total = signal(0);
  readonly primerRegistro = signal(0);
  readonly resumen = signal<ResumenPorEstado>({
    Creado: 0,
    'En proceso': 0,
    Completado: 0,
    Error: 0,
  });

  readonly estados = ESTADOS;
  readonly novedades = signal<OpcionNovedad[]>([]);
  readonly usuarios = signal<OpcionUsuario[]>([]);

  readonly rangoFechas = signal<Date[] | null>([new Date(), new Date()]);
  readonly filtroNovedad = signal<number[]>([]);
  readonly filtroUsuario = signal<number[]>([]);
  readonly filtroEstado = signal<EstadoSoporte[]>([]);

  ngOnInit(): void {
    void this.cargarOpciones();
    void this.cargarResumen();
  }

  async cargar(event?: TableLazyLoadEvent): Promise<void> {
    const rows = event?.rows ?? this.rows;
    const page = Math.floor((event?.first ?? this.primerRegistro()) / rows) + 1;
    this.loadingService.show('Cargando informes...');
    try {
      const params = this.construirParams({ page, limit: rows });
      const respuesta = await firstValueFrom(
        this.http.get<ResponseEnvelope<RegistroInforme[]>>('/api/informes', { params }),
      );
      this.registros.set(respuesta.data ?? []);
      this.total.set(respuesta.pagination?.total ?? 0);
    } catch {
      this.toastService.error('No se pudieron cargar los informes.');
    } finally {
      this.loadingService.hide();
    }
  }

  async cargarResumen(): Promise<void> {
    try {
      const params = this.construirParams(null);
      const respuesta = await firstValueFrom(
        this.http.get<ResponseEnvelope<ResumenPorEstado>>('/api/informes/resumen', { params }),
      );
      if (respuesta.data) {
        this.resumen.set(respuesta.data);
      }
    } catch {
      this.toastService.error('No se pudo cargar el resumen.');
    }
  }

  /** Fecha, novedad o usuario cambiaron: tabla y tarjetas se recalculan (ver planing/05-reglas-ui-ux.md). */
  async onFiltroChange(): Promise<void> {
    this.primerRegistro.set(0);
    await Promise.all([this.cargar(), this.cargarResumen()]);
  }

  /** El filtro de estado solo acota la tabla, nunca las tarjetas de resumen. */
  async onFiltroEstadoChange(): Promise<void> {
    this.primerRegistro.set(0);
    await this.cargar();
  }

  async exportar(): Promise<void> {
    this.loadingService.show('Generando archivo...');
    try {
      const params = this.construirParams(null);
      const blob = await firstValueFrom(
        this.http.get('/api/informes/exportar', { params, responseType: 'blob' }),
      );
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `informes-soporte-${this.formatearFecha(new Date())}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toastService.error('No se pudo generar el archivo.');
    } finally {
      this.loadingService.hide();
    }
  }

  /**
   * Novedad depende de `Novedades → Opciones` (sin él queda vacío). Usuario lista solo a los
   * responsables que tienen registros en soporte (`GET /informes/usuarios`, permiso del informe).
   */
  private async cargarOpciones(): Promise<void> {
    const [novedades, usuarios] = await Promise.allSettled([
      firstValueFrom(this.http.get<ResponseEnvelope<OpcionNovedad[]>>('/api/novedades/opciones')),
      firstValueFrom(this.http.get<ResponseEnvelope<OpcionUsuario[]>>('/api/informes/usuarios')),
    ]);
    this.novedades.set(novedades.status === 'fulfilled' ? (novedades.value.data ?? []) : []);
    this.usuarios.set(usuarios.status === 'fulfilled' ? (usuarios.value.data ?? []) : []);
  }

  private construirParams(paginacion: { page: number; limit: number } | null): HttpParams {
    let params = new HttpParams();
    const [inicio, fin] = this.rangoFechas() ?? [null, null];
    if (inicio) {
      params = params.set('fechaInicio', this.formatearFecha(inicio));
    }
    if (fin) {
      params = params.set('fechaFin', this.formatearFecha(fin));
    }
    for (const id of this.filtroNovedad()) {
      params = params.append('idNovedad', id);
    }
    for (const id of this.filtroUsuario()) {
      params = params.append('idUsuario', id);
    }
    for (const estado of this.filtroEstado()) {
      params = params.append('estadoSoporte', estado);
    }
    if (paginacion) {
      params = params.set('page', paginacion.page).set('limit', paginacion.limit);
    }
    return params;
  }

  colorEstado(estado: EstadoSoporte): string {
    return COLORES_ESTADO[estado];
  }

  iconoEstado(estado: EstadoSoporte): string {
    return ICONOS_ESTADO[estado];
  }

  private formatearFecha(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  severidadEstado(estado: EstadoSoporte): 'success' | 'danger' | 'warn' | 'secondary' {
    return SEVERIDAD_ESTADO[estado] ?? 'secondary';
  }

  estiloResultado(estado: EstadoSoporte): { icono: string; borde: string } {
    return ESTILO_RESULTADO[estado] ?? ESTILO_RESULTADO.Creado;
  }

  /** Tooltip de la celda: vistazo rápido; el texto completo está en el detalle de la fila. */
  vistaPrevia(texto: string | null): string {
    if (!texto) {
      return '';
    }
    return texto.length > LARGO_VISTA_PREVIA ? `${texto.slice(0, LARGO_VISTA_PREVIA)}… (ver detalle)` : texto;
  }

  async copiar(texto: string | null, aviso: string): Promise<void> {
    if (!texto) {
      return;
    }
    if (await copiarTexto(texto)) {
      this.toastService.success(`${aviso} al portapapeles.`);
    } else {
      this.toastService.error('No se pudo copiar, selecciona el texto y cópialo manualmente.');
    }
  }

}

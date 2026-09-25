import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToastService } from '../../core/services/toast.service';
import { LoadingService } from '../../core/services/loading.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ResponseEnvelope } from '../../core/envelope.model';
import { MotorSoporte, OpcionMotor, etiquetaOpcionMotor } from '../../core/utils/motor.util';
import { capitalizarPalabras } from '../../core/utils/texto.util';
import { sentenciaSegunMotorValidator } from '../../core/utils/sentencia.util';
import { copiarTexto } from '../../core/utils/portapapeles.util';
import { AlertaResultadoComponent } from '../../shared/alerta-resultado/alerta-resultado.component';
import { esLimiteExcedido } from '../../core/utils/limite-excedido.util';

const MODULO = 'Soporte';

export interface RegistroSoporte {
  id: number;
  cliente: string;
  mensajeWhatsapp: string;
  motor: MotorSoporte;
  sentencia: string;
  idNovedad: number;
  estadoSoporte: 'Creado' | 'En proceso' | 'Completado' | 'Error';
  descripcion: string | null;
}

export interface OpcionNovedad {
  id: number;
  novedad: string;
}

@Component({
  selector: 'app-soporte',
  imports: [ReactiveFormsModule, NgTemplateOutlet, AutoComplete, ButtonModule, Card, Select, Textarea, AlertaResultadoComponent],
  templateUrl: './soporte.component.html',
})
export class SoporteComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly loadingService = inject(LoadingService);
  private readonly permisosService = inject(PermisosService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly puedeCrear = computed(() => this.permisosService.tiene(MODULO, 'Crear'));

  readonly registro = signal<RegistroSoporte | null>(null);
  readonly copiado = signal(false);
  readonly novedades = signal<OpcionNovedad[]>([]);
  readonly sugerenciasCliente = signal<string[]>([]);
  /** Sentencia rechazada por el backend (422): se muestra en amarillo, no como error. */
  readonly advertencia = signal<string | null>(null);
  /** Conexiones activas de Configuración: el valor es `nombre` y el texto, motor y alcance. */
  readonly motores = signal<{ label: string; value: MotorSoporte }[]>([]);

  readonly form = this.fb.nonNullable.group({
    cliente: ['', [Validators.required, Validators.maxLength(100)]],
    idNovedad: this.fb.control<number | null>(null, [Validators.required]),
    mensajeWhatsapp: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
    motor: this.fb.control<MotorSoporte | null>(null, [Validators.required]),
    sentencia: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(5000)]],
  }, { validators: [sentenciaSegunMotorValidator] });

  ngOnInit(): void {
    // Cliente: primera letra de cada palabra en mayúscula mientras se escribe (ej. "Pepe Prueba"),
    // igual a como lo guarda el backend. Va por valueChanges porque p-autocomplete no expone (input).
    this.form.controls.cliente.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      const formateado = capitalizarPalabras((valor ?? '').toLowerCase());
      if (formateado !== valor) {
        this.form.controls.cliente.setValue(formateado, { emitEvent: false });
      }
    });

    // Al corregir la sentencia o cambiar el motor, se limpia la advertencia que devolvió el backend.
    this.form.controls.sentencia.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.advertencia.set(null));
    this.form.controls.motor.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.advertencia.set(null));

    this.http
      .get<ResponseEnvelope<OpcionNovedad[]>>('/api/novedades/opciones')
      .subscribe((respuesta) => this.novedades.set(respuesta.data ?? []));

    this.http
      .get<ResponseEnvelope<OpcionMotor[]>>('/api/soporte/motores')
      .subscribe((respuesta) =>
        this.motores.set((respuesta.data ?? []).map((opcion) => ({ label: etiquetaOpcionMotor(opcion), value: opcion.nombre }))),
      );
  }

  /** Sugiere clientes ya registrados para que se reutilice la misma escritura; igual se permite uno nuevo. */
  buscarClientes(evento: AutoCompleteCompleteEvent): void {
    this.http
      .get<ResponseEnvelope<string[]>>('/api/soporte/clientes', { params: { q: evento.query } })
      .subscribe({
        next: (respuesta) => this.sugerenciasCliente.set(respuesta.data ?? []),
        error: () => this.sugerenciasCliente.set([]),
      });
  }

  async registrarYEjecutar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const actual = this.registro();
    try {
      let id: number;
      if (actual && actual.estadoSoporte === 'Error') {
        // Reintento sobre el mismo registro: primero guarda los cambios (por si corrigieron la sentencia).
        this.loadingService.show('Guardando cambios...');
        const { cliente, idNovedad, mensajeWhatsapp, motor, sentencia } = this.form.getRawValue();
        await firstValueFrom(
          this.http.patch<ResponseEnvelope<RegistroSoporte>>(`/api/soporte/${actual.id}`, {
            cliente,
            idNovedad,
            mensajeWhatsapp,
            motor,
            sentencia,
          }),
        );
        id = actual.id;
      } else {
        this.loadingService.show('Guardando registro...');
        const respuestaCrear = await firstValueFrom(
          this.http.post<ResponseEnvelope<RegistroSoporte>>('/api/soporte', this.form.getRawValue()),
        );
        id = (respuestaCrear.data as RegistroSoporte).id;
      }

      this.loadingService.show('Ejecutando sentencia...');
      const respuestaEjecutar = await firstValueFrom(
        this.http.post<ResponseEnvelope<RegistroSoporte>>(`/api/soporte/${id}/ejecutar`, {}),
      );
      const resultado = respuestaEjecutar.data as RegistroSoporte;
      this.registro.set(resultado);

      if (resultado.estadoSoporte === 'Completado') {
        this.toastService.success('Sentencia ejecutada correctamente.');
      } else {
        this.toastService.error(resultado.descripcion ?? 'La sentencia no se pudo ejecutar.');
      }
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        this.advertencia.set(this.extraerMensaje(error));
      } else if (esLimiteExcedido(error)) {
        this.toastService.warning(this.extraerMensaje(error));
      } else {
        this.toastService.error(this.extraerMensaje(error));
      }
    } finally {
      this.loadingService.hide();
    }
  }

  /** Advertencia amarilla: la del backend (422) o la que ya detecta el formulario mientras se escribe. */
  readonly mensajeAdvertencia = (): string | null =>
    this.advertencia() ?? (this.form.errors?.['sentenciaNoPermitida'] as string | undefined) ?? null;

  async copiarMensaje(): Promise<void> {
    const mensaje = this.registro()?.descripcion;
    if (!mensaje) {
      return;
    }
    if (!(await copiarTexto(mensaje))) {
      this.toastService.error('No se pudo copiar, selecciona el mensaje y cópialo manualmente.');
      return;
    }
    this.copiado.set(true);
    this.toastService.success('Mensaje copiado al portapapeles.');
    setTimeout(() => this.nuevoFormulario(), 600);
  }

  /** Copia el mensaje de error o advertencia (no limpia el formulario: hay que corregir y reintentar). */
  async copiarTexto(texto: string | null | undefined): Promise<void> {
    if (!texto) {
      return;
    }
    if (await copiarTexto(texto)) {
      this.toastService.success('Mensaje copiado al portapapeles.');
    } else {
      this.toastService.error('No se pudo copiar, selecciona el mensaje y cópialo manualmente.');
    }
  }

  nuevoFormulario(): void {
    this.form.reset({ cliente: '', idNovedad: null, mensajeWhatsapp: '', motor: null, sentencia: '' });
    this.registro.set(null);
    this.copiado.set(false);
    this.advertencia.set(null);
  }

  private extraerMensaje(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const envelope = error.error as ResponseEnvelope | undefined;
      if (envelope?.message) {
        return envelope.message;
      }
    }
    return 'Ocurrió un error, intenta de nuevo.';
  }
}

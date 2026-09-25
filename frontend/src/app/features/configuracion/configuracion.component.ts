import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToastService } from '../../core/services/toast.service';
import { LoadingService } from '../../core/services/loading.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ResponseEnvelope } from '../../core/envelope.model';
import { capitalizarPrimeraLetra } from '../../core/utils/texto.util';
import { VacioPipe } from '../../shared/pipes/vacio.pipe';
import { TablaResponsivaDirective } from '../../shared/directives/tabla-responsiva.directive';

const MODULO = 'Configuración';

/**
 * El formulario maneja todo valor como texto. El backend lo convierte al tipo que necesita
 * cada clave al guardar (ej. `port` -> número, `ssl` -> sí/no), así quien configura no
 * tiene que elegir tipos.
 */
function valorComoTexto(valor: unknown): string {
  return Array.isArray(valor) ? valor.join(', ') : String(valor ?? '');
}

/** Las claves no se pueden repetir dentro del mismo objeto. */
function clavesUnicasValidator(pares: AbstractControl): ValidationErrors | null {
  const claves = (pares as FormArray<FormGroup>).controls
    .map((fila) => ((fila.get('clave')?.value as string | null) ?? '').trim())
    .filter(Boolean);
  return new Set(claves).size === claves.length ? null : { clavesDuplicadas: true };
}

/** Mínimo de caracteres sin contar los espacios de los extremos (se envía recortado). */
function minimoRecortadoValidator(minimo: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = ((control.value as string | null) ?? '').trim();
    return control.value && texto.length < minimo ? { minlength: { requiredLength: minimo, actualLength: texto.length } } : null;
  };
}

export interface Configuracion {
  id: number;
  nombre: string;
  alcance: string;
  objeto: Record<string, unknown>;
  estadoRegistro: number;
  descripcion: string | null;
  responsable: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

@Component({
  selector: 'app-configuracion',
  imports: [TableModule, ButtonModule, Dialog, ReactiveFormsModule, InputText, Select, Textarea, DatePipe, VacioPipe, TablaResponsivaDirective],
  templateUrl: './configuracion.component.html',
})
export class ConfiguracionComponent {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly permisosService = inject(PermisosService);
  private readonly fb = inject(FormBuilder);

  readonly rows = 10;
  readonly configuraciones = signal<Configuracion[]>([]);
  readonly total = signal(0);

  readonly estados = [
    { label: 'Activo', value: 1 },
    { label: 'Inactivo', value: 0 },
  ];

  readonly puedeCrear = computed(() => this.permisosService.tiene(MODULO, 'Crear'));
  readonly puedeEditar = computed(() => this.permisosService.tiene(MODULO, 'Editar'));
  readonly puedeEliminar = computed(() => this.permisosService.tiene(MODULO, 'Eliminar'));

  readonly dialogoVisible = signal(false);
  readonly editando = signal<Configuracion | null>(null);

  readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(45)]),
    alcance: this.fb.nonNullable.control('', [Validators.required, minimoRecortadoValidator(3), Validators.maxLength(45)]),
    estadoRegistro: this.fb.nonNullable.control(1),
    descripcion: this.fb.nonNullable.control('', [Validators.minLength(3), Validators.maxLength(255)]),
    pares: this.fb.array<FormGroup>([], [clavesUnicasValidator]),
  });

  get pares(): FormArray<FormGroup> {
    return this.form.controls.pares;
  }

  async cargar(event?: TableLazyLoadEvent): Promise<void> {
    const rows = event?.rows ?? this.rows;
    const page = Math.floor((event?.first ?? 0) / rows) + 1;
    this.loadingService.show('Cargando configuración...');
    try {
      const params = new HttpParams().set('page', page).set('limit', rows);
      const respuesta = await firstValueFrom(
        this.http.get<ResponseEnvelope<Configuracion[]>>('/api/configuracion', { params }),
      );
      this.configuraciones.set(respuesta.data ?? []);
      this.total.set(respuesta.pagination?.total ?? 0);
    } catch {
      this.toastService.error('No se pudo cargar la configuración.');
    } finally {
      this.loadingService.hide();
    }
  }

  onDescripcionInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.form.controls.descripcion.setValue(capitalizarPrimeraLetra(input.value), { emitEvent: false });
  }

  agregarPar(clave = '', valor: unknown = ''): void {
    this.pares.push(
      this.fb.group({
        clave: this.fb.nonNullable.control(clave, [Validators.required]),
        valor: this.fb.nonNullable.control(valorComoTexto(valor)),
      }),
    );
  }

  quitarPar(index: number): void {
    this.pares.removeAt(index);
  }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', alcance: '', estadoRegistro: 1, descripcion: '' });
    this.pares.clear();
    this.dialogoVisible.set(true);
  }

  editar(configuracion: Configuracion): void {
    this.editando.set(configuracion);
    this.form.reset({
      nombre: configuracion.nombre,
      alcance: configuracion.alcance,
      estadoRegistro: configuracion.estadoRegistro,
      descripcion: configuracion.descripcion ?? '',
    });
    this.pares.clear();
    for (const [clave, valor] of Object.entries(configuracion.objeto ?? {})) {
      this.agregarPar(clave, valor);
    }
    this.dialogoVisible.set(true);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const actual = this.editando();
    const { nombre, estadoRegistro, descripcion } = this.form.getRawValue();
    const alcance = this.form.controls.alcance.value.trim();
    const objeto = Object.fromEntries(
      this.pares.controls.map((fila) => {
        const { clave, valor } = fila.getRawValue() as { clave: string; valor: string };
        return [clave.trim(), valor];
      }),
    );

    this.loadingService.show(actual ? 'Actualizando configuración...' : 'Guardando configuración...');
    try {
      if (actual) {
        await firstValueFrom(
          this.http.patch<ResponseEnvelope<Configuracion>>(`/api/configuracion/${actual.id}`, {
            nombre,
            alcance,
            objeto,
            estadoRegistro,
            descripcion: descripcion?.trim() || undefined,
          }),
        );
        this.toastService.success('Configuración actualizada correctamente.');
      } else {
        await firstValueFrom(
          this.http.post<ResponseEnvelope<Configuracion>>('/api/configuracion', {
            nombre,
            alcance,
            objeto,
            descripcion: descripcion?.trim() || undefined,
          }),
        );
        this.toastService.success('Configuración creada correctamente. Si ya había una activa con este nombre, quedó desactivada.');
      }
      this.dialogoVisible.set(false);
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  async eliminar(configuracion: Configuracion): Promise<void> {
    if (!(await this.confirmService.eliminar())) {
      return;
    }
    this.loadingService.show('Eliminando configuración...');
    try {
      await firstValueFrom(this.http.delete<ResponseEnvelope<null>>(`/api/configuracion/${configuracion.id}`));
      this.toastService.success('Configuración eliminada correctamente.');
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  objetoResumen(objeto: Record<string, unknown>): string {
    return Object.entries(objeto ?? {})
      .map(([clave, dato]) => `${clave}: ${valorComoTexto(dato)}`)
      .join(' | ');
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

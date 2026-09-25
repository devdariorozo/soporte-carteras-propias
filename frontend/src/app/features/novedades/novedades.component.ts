import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { ToastService } from '../../core/services/toast.service';
import { LoadingService } from '../../core/services/loading.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ResponseEnvelope } from '../../core/envelope.model';
import { capitalizarPalabras, capitalizarPrimeraLetra } from '../../core/utils/texto.util';
import { VacioPipe } from '../../shared/pipes/vacio.pipe';
import { TablaResponsivaDirective } from '../../shared/directives/tabla-responsiva.directive';

const MODULO = 'Novedades';

export interface Novedad {
  id: number;
  novedad: string;
  estadoRegistro: number;
  descripcion: string | null;
  responsable: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

@Component({
  selector: 'app-novedades',
  imports: [TableModule, ButtonModule, Dialog, ReactiveFormsModule, InputText, Textarea, Select, DatePipe, VacioPipe, TablaResponsivaDirective],
  templateUrl: './novedades.component.html',
})
export class NovedadesComponent {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly permisosService = inject(PermisosService);
  private readonly fb = inject(FormBuilder);

  readonly rows = 10;
  readonly novedades = signal<Novedad[]>([]);
  readonly total = signal(0);

  readonly estados = [
    { label: 'Activo', value: 1 },
    { label: 'Inactivo', value: 0 },
  ];

  readonly puedeCrear = computed(() => this.permisosService.tiene(MODULO, 'Crear'));
  readonly puedeEditar = computed(() => this.permisosService.tiene(MODULO, 'Editar'));
  readonly puedeEliminar = computed(() => this.permisosService.tiene(MODULO, 'Eliminar'));

  readonly dialogoVisible = signal(false);
  readonly editando = signal<Novedad | null>(null);
  readonly form = this.fb.nonNullable.group({
    novedad: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    estadoRegistro: [1],
    descripcion: ['', [Validators.minLength(3), Validators.maxLength(255)]],
  });

  async cargar(event?: TableLazyLoadEvent): Promise<void> {
    const rows = event?.rows ?? this.rows;
    const page = Math.floor((event?.first ?? 0) / rows) + 1;
    this.loadingService.show('Cargando novedades...');
    try {
      const params = new HttpParams().set('page', page).set('limit', rows);
      const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<Novedad[]>>('/api/novedades', { params }));
      this.novedades.set(respuesta.data ?? []);
      this.total.set(respuesta.pagination?.total ?? 0);
    } catch {
      this.toastService.error('No se pudieron cargar las novedades.');
    } finally {
      this.loadingService.hide();
    }
  }

  onNovedadInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls.novedad.setValue(capitalizarPalabras(input.value), { emitEvent: false });
  }

  onDescripcionInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.form.controls.descripcion.setValue(capitalizarPrimeraLetra(input.value), { emitEvent: false });
  }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ novedad: '', estadoRegistro: 1, descripcion: '' });
    this.dialogoVisible.set(true);
  }

  editar(novedad: Novedad): void {
    this.editando.set(novedad);
    this.form.reset({ novedad: novedad.novedad, estadoRegistro: novedad.estadoRegistro, descripcion: novedad.descripcion ?? '' });
    this.dialogoVisible.set(true);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const actual = this.editando();
    const { novedad, estadoRegistro, descripcion } = this.form.getRawValue();
    const cuerpo: Record<string, unknown> = { novedad, descripcion: descripcion?.trim() || undefined };
    if (actual) {
      cuerpo['estadoRegistro'] = estadoRegistro;
    }

    this.loadingService.show(actual ? 'Actualizando novedad...' : 'Creando novedad...');
    try {
      if (actual) {
        await firstValueFrom(this.http.patch<ResponseEnvelope<Novedad>>(`/api/novedades/${actual.id}`, cuerpo));
      } else {
        await firstValueFrom(this.http.post<ResponseEnvelope<Novedad>>('/api/novedades', cuerpo));
      }
      this.toastService.success(actual ? 'Novedad actualizada correctamente.' : 'Novedad creada correctamente.');
      this.dialogoVisible.set(false);
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  async eliminar(novedad: Novedad): Promise<void> {
    if (!(await this.confirmService.eliminar())) {
      return;
    }
    this.loadingService.show('Eliminando novedad...');
    try {
      await firstValueFrom(this.http.delete<ResponseEnvelope<null>>(`/api/novedades/${novedad.id}`));
      this.toastService.success('Novedad eliminada correctamente.');
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
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

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
import { AuthService } from '../../core/services/auth.service';
import { nivelRol, puedeGestionarRol } from '../../core/utils/jerarquia-roles.util';
import { TablaResponsivaDirective } from '../../shared/directives/tabla-responsiva.directive';

const MODULO = 'Roles';

/** Lo que devuelve `GET /roles/opciones` para los selects. */
export interface OpcionRol {
  id: number;
  rol: string;
}

export interface Rol {
  id: number;
  rol: string;
  estadoRegistro: number;
  descripcion: string | null;
  responsable: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

@Component({
  selector: 'app-roles',
  imports: [TableModule, ButtonModule, Dialog, ReactiveFormsModule, InputText, Textarea, Select, DatePipe, VacioPipe, TablaResponsivaDirective],
  templateUrl: './roles.component.html',
})
export class RolesComponent {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly permisosService = inject(PermisosService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly rows = 10;
  readonly roles = signal<Rol[]>([]);
  readonly total = signal(0);

  readonly puedeCrear = computed(() => this.permisosService.tiene(MODULO, 'Crear'));
  readonly puedeEditar = computed(() => this.permisosService.tiene(MODULO, 'Editar'));
  readonly puedeEliminar = computed(() => this.permisosService.tiene(MODULO, 'Eliminar'));
  readonly nivelActor = computed(() => nivelRol(this.authService.usuario()));

  /** Roles por encima del propio (id menor): no se editan ni eliminan. */
  reservado(rol: Rol): boolean {
    return !puedeGestionarRol(this.nivelActor(), rol.id);
  }

  readonly estados = [
    { label: 'Activo', value: 1 },
    { label: 'Inactivo', value: 0 },
  ];

  readonly dialogoVisible = signal(false);
  readonly editando = signal<Rol | null>(null);
  readonly form = this.fb.nonNullable.group({
    rol: ['', [Validators.required]],
    estadoRegistro: [1],
    descripcion: ['', [Validators.minLength(3), Validators.maxLength(255)]],
  });

  async cargar(event?: TableLazyLoadEvent): Promise<void> {
    const rows = event?.rows ?? this.rows;
    const page = Math.floor((event?.first ?? 0) / rows) + 1;
    this.loadingService.show('Cargando roles...');
    try {
      const params = new HttpParams().set('page', page).set('limit', rows);
      const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<Rol[]>>('/api/roles', { params }));
      this.roles.set(respuesta.data ?? []);
      this.total.set(respuesta.pagination?.total ?? 0);
    } catch {
      this.toastService.error('No se pudieron cargar los roles.');
    } finally {
      this.loadingService.hide();
    }
  }

  onRolInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls.rol.setValue(capitalizarPalabras(input.value), { emitEvent: false });
  }

  onDescripcionInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.form.controls.descripcion.setValue(capitalizarPrimeraLetra(input.value), { emitEvent: false });
  }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ rol: '', estadoRegistro: 1, descripcion: '' });
    this.dialogoVisible.set(true);
  }

  editar(rol: Rol): void {
    this.editando.set(rol);
    this.form.reset({ rol: rol.rol, estadoRegistro: rol.estadoRegistro, descripcion: rol.descripcion ?? '' });
    this.dialogoVisible.set(true);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const actual = this.editando();
    const { rol, estadoRegistro, descripcion } = this.form.getRawValue();
    const cuerpo: Record<string, unknown> = { rol, descripcion: descripcion?.trim() || undefined };
    if (actual) {
      cuerpo['estadoRegistro'] = estadoRegistro;
    }

    this.loadingService.show(actual ? 'Actualizando rol...' : 'Creando rol...');
    try {
      if (actual) {
        await firstValueFrom(this.http.patch<ResponseEnvelope<Rol>>(`/api/roles/${actual.id}`, cuerpo));
      } else {
        await firstValueFrom(this.http.post<ResponseEnvelope<Rol>>('/api/roles', cuerpo));
      }
      this.toastService.success(actual ? 'Rol actualizado correctamente.' : 'Rol creado correctamente.');
      this.dialogoVisible.set(false);
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  async eliminar(rol: Rol): Promise<void> {
    if (!(await this.confirmService.eliminar())) {
      return;
    }
    this.loadingService.show('Eliminando rol...');
    try {
      await firstValueFrom(this.http.delete<ResponseEnvelope<null>>(`/api/roles/${rol.id}`));
      this.toastService.success('Rol eliminado correctamente.');
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

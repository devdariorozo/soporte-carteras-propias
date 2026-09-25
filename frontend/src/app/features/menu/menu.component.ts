import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
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
import { RUTA_CONFIGURACION, esSuperAdministrador } from '../../core/utils/jerarquia-roles.util';
import { TablaResponsivaDirective } from '../../shared/directives/tabla-responsiva.directive';

const MODULO = 'Menu';

export interface OpcionMenu {
  id: number;
  apartado: string;
  menu: string;
  ruta: string;
  icono: string;
  orden: number;
  estadoRegistro: number;
  descripcion: string | null;
  responsable: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

@Component({
  selector: 'app-menu',
  imports: [TableModule, ButtonModule, Dialog, ReactiveFormsModule, InputText, InputNumber, Textarea, Select, DatePipe, VacioPipe, TablaResponsivaDirective],
  templateUrl: './menu.component.html',
})
export class MenuComponent {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly permisosService = inject(PermisosService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly rows = 10;
  readonly opciones = signal<OpcionMenu[]>([]);
  readonly total = signal(0);

  readonly estados = [
    { label: 'Activo', value: 1 },
    { label: 'Inactivo', value: 0 },
  ];

  readonly puedeCrear = computed(() => this.permisosService.tiene(MODULO, 'Crear'));
  readonly puedeEditar = computed(() => this.permisosService.tiene(MODULO, 'Editar'));
  readonly puedeEliminar = computed(() => this.permisosService.tiene(MODULO, 'Eliminar'));
  readonly esSuperAdmin = computed(() => esSuperAdministrador(this.authService.usuario()?.rol));

  /** La opción Configuración solo la modifica o elimina un Super Administrador. */
  reservado(opcion: OpcionMenu): boolean {
    return !this.esSuperAdmin() && opcion.ruta === RUTA_CONFIGURACION;
  }

  readonly dialogoVisible = signal(false);
  readonly editando = signal<OpcionMenu | null>(null);
  readonly form = this.fb.nonNullable.group({
    apartado: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    menu: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    ruta: ['', [Validators.required, Validators.pattern(/^\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/)]],
    icono: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    orden: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    estadoRegistro: [1],
    descripcion: ['', [Validators.minLength(3), Validators.maxLength(255)]],
  });

  async cargar(event?: TableLazyLoadEvent): Promise<void> {
    const rows = event?.rows ?? this.rows;
    const page = Math.floor((event?.first ?? 0) / rows) + 1;
    this.loadingService.show('Cargando menú...');
    try {
      const params = new HttpParams().set('page', page).set('limit', rows);
      const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<OpcionMenu[]>>('/api/menu', { params }));
      this.opciones.set(respuesta.data ?? []);
      this.total.set(respuesta.pagination?.total ?? 0);
    } catch {
      this.toastService.error('No se pudo cargar el menú.');
    } finally {
      this.loadingService.hide();
    }
  }

  onCapitalizarInput(control: 'apartado' | 'menu', event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls[control].setValue(capitalizarPalabras(input.value), { emitEvent: false });
  }

  onDescripcionInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.form.controls.descripcion.setValue(capitalizarPrimeraLetra(input.value), { emitEvent: false });
  }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ apartado: '', menu: '', ruta: '', icono: '', orden: null, estadoRegistro: 1, descripcion: '' });
    this.dialogoVisible.set(true);
  }

  editar(opcion: OpcionMenu): void {
    this.editando.set(opcion);
    this.form.reset({
      apartado: opcion.apartado,
      menu: opcion.menu,
      ruta: opcion.ruta,
      icono: opcion.icono,
      orden: opcion.orden,
      estadoRegistro: opcion.estadoRegistro,
      descripcion: opcion.descripcion ?? '',
    });
    this.dialogoVisible.set(true);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const actual = this.editando();
    const { descripcion, ...datos } = this.form.getRawValue();
    const cuerpo: Record<string, unknown> = { ...datos, descripcion: descripcion?.trim() || undefined };
    if (!actual) {
      delete cuerpo['estadoRegistro'];
    }

    this.loadingService.show(actual ? 'Actualizando menú...' : 'Creando opción de menú...');
    try {
      if (actual) {
        await firstValueFrom(this.http.patch<ResponseEnvelope<OpcionMenu>>(`/api/menu/${actual.id}`, cuerpo));
      } else {
        await firstValueFrom(this.http.post<ResponseEnvelope<OpcionMenu>>('/api/menu', cuerpo));
      }
      this.toastService.success(actual ? 'Menú actualizado correctamente.' : 'Opción de menú creada correctamente.');
      this.dialogoVisible.set(false);
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  async eliminar(opcion: OpcionMenu): Promise<void> {
    if (!(await this.confirmService.eliminar())) {
      return;
    }
    this.loadingService.show('Eliminando opción de menú...');
    try {
      await firstValueFrom(this.http.delete<ResponseEnvelope<null>>(`/api/menu/${opcion.id}`));
      this.toastService.success('Opción de menú eliminada correctamente.');
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

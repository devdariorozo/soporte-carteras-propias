import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToastService } from '../../core/services/toast.service';
import { LoadingService } from '../../core/services/loading.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ResponseEnvelope } from '../../core/envelope.model';
import { OpcionRol, Rol } from '../roles/roles.component';
import { capitalizarPrimeraLetra } from '../../core/utils/texto.util';
import { VacioPipe } from '../../shared/pipes/vacio.pipe';
import { AuthService } from '../../core/services/auth.service';
import { MENU_CONFIGURACION, esSuperAdministrador, nivelRol, puedeGestionarRol } from '../../core/utils/jerarquia-roles.util';
import { TablaResponsivaDirective } from '../../shared/directives/tabla-responsiva.directive';

const MODULO = 'Permisos';

export const ACCIONES_PERMISO = ['Crear', 'Editar', 'Eliminar', 'Consultar'];
const ACCIONES_CON_OPCIONES = [...ACCIONES_PERMISO, 'Opciones'];

/**
 * Misma regla que el backend (`ACCIONES_POR_MENU` en permiso.entity.ts): Opciones solo en
 * los módulos que alimentan selects de otras vistas; Informe solo admite Consultar.
 */
const ACCIONES_POR_MENU: Record<string, string[]> = {
  Roles: ACCIONES_CON_OPCIONES,
  Usuarios: ACCIONES_CON_OPCIONES,
  Novedades: ACCIONES_CON_OPCIONES,
  Informe: ['Consultar'],
};

interface OpcionMenuActiva {
  menu: string;
}

export interface Permiso {
  id: number;
  idRol: number;
  menu: string;
  permiso: string;
  estadoRegistro: number;
  descripcion: string | null;
  responsable: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  rolRef?: Rol;
}

@Component({
  selector: 'app-permisos',
  imports: [TableModule, ButtonModule, Dialog, ReactiveFormsModule, Select, Textarea, DatePipe, VacioPipe, TablaResponsivaDirective],
  templateUrl: './permisos.component.html',
})
export class PermisosComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly permisosService = inject(PermisosService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly rows = 10;
  readonly permisos = signal<Permiso[]>([]);
  readonly total = signal(0);
  readonly roles = signal<OpcionRol[]>([]);
  readonly menus = signal<string[]>([]);

  readonly esSuperAdmin = computed(() => esSuperAdministrador(this.authService.usuario()?.rol));
  readonly nivelActor = computed(() => nivelRol(this.authService.usuario()));
  readonly menusAsignables = computed(() =>
    this.esSuperAdmin() ? this.menus() : this.menus().filter((menu) => menu !== MENU_CONFIGURACION),
  );

  readonly estados = [
    { label: 'Activo', value: 1 },
    { label: 'Inactivo', value: 0 },
  ];

  readonly puedeCrear = computed(() => this.permisosService.tiene(MODULO, 'Crear'));
  readonly puedeEditar = computed(() => this.permisosService.tiene(MODULO, 'Editar'));
  readonly puedeEliminar = computed(() => this.permisosService.tiene(MODULO, 'Eliminar'));

  readonly dialogoVisible = signal(false);
  readonly editando = signal<Permiso | null>(null);
  readonly form = this.fb.nonNullable.group({
    idRol: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    menu: ['', [Validators.required]],
    permiso: ['', [Validators.required]],
    estadoRegistro: [1],
    descripcion: ['', [Validators.minLength(3), Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    void this.cargarRoles();
    void this.cargarMenus();
  }

  /** Roles activos del nivel propio hacia abajo (`Roles → Opciones`); sin ese permiso el select queda vacío. */
  private async cargarRoles(): Promise<void> {
    try {
      const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<OpcionRol[]>>('/api/roles/opciones'));
      this.roles.set(respuesta.data ?? []);
    } catch {
      this.roles.set([]);
    }
  }

  private async cargarMenus(): Promise<void> {
    const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<OpcionMenuActiva[]>>('/api/menu/activos'));
    this.menus.set((respuesta.data ?? []).map((opcion) => opcion.menu));
  }

  async cargar(event?: TableLazyLoadEvent): Promise<void> {
    const rows = event?.rows ?? this.rows;
    const page = Math.floor((event?.first ?? 0) / rows) + 1;
    this.loadingService.show('Cargando permisos...');
    try {
      const params = new HttpParams().set('page', page).set('limit', rows);
      const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<Permiso[]>>('/api/permisos', { params }));
      this.permisos.set(respuesta.data ?? []);
      this.total.set(respuesta.pagination?.total ?? 0);
    } catch {
      this.toastService.error('No se pudieron cargar los permisos.');
    } finally {
      this.loadingService.hide();
    }
  }

  accionesPara(menu: string): string[] {
    return ACCIONES_POR_MENU[menu] ?? ACCIONES_PERMISO;
  }

  /** Si la acción elegida no aplica al nuevo menú (ej. Crear en Informe), se limpia. */
  onMenuChange(): void {
    const { menu, permiso } = this.form.getRawValue();
    if (permiso && !this.accionesPara(menu).includes(permiso)) {
      this.form.controls.permiso.setValue('');
    }
  }

  onDescripcionInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.form.controls.descripcion.setValue(capitalizarPrimeraLetra(input.value), { emitEvent: false });
  }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ idRol: null, menu: '', permiso: '', estadoRegistro: 1, descripcion: '' });
    this.dialogoVisible.set(true);
  }

  editar(permiso: Permiso): void {
    this.editando.set(permiso);
    this.form.reset({
      idRol: permiso.idRol,
      menu: permiso.menu,
      permiso: permiso.permiso,
      estadoRegistro: permiso.estadoRegistro,
      descripcion: permiso.descripcion ?? '',
    });
    this.dialogoVisible.set(true);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const actual = this.editando();
    const { idRol, menu, permiso, estadoRegistro, descripcion } = this.form.getRawValue();
    const cuerpo: Record<string, unknown> = { idRol, menu, permiso, descripcion: descripcion?.trim() || undefined };
    if (actual) {
      cuerpo['estadoRegistro'] = estadoRegistro;
    }

    this.loadingService.show(actual ? 'Actualizando permiso...' : 'Creando permiso...');
    try {
      if (actual) {
        await firstValueFrom(this.http.patch<ResponseEnvelope<Permiso>>(`/api/permisos/${actual.id}`, cuerpo));
      } else {
        await firstValueFrom(this.http.post<ResponseEnvelope<Permiso>>('/api/permisos', cuerpo));
      }
      this.toastService.success(actual ? 'Permiso actualizado correctamente.' : 'Permiso creado correctamente.');
      this.dialogoVisible.set(false);
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  async eliminar(permiso: Permiso): Promise<void> {
    if (!(await this.confirmService.eliminar())) {
      return;
    }
    this.loadingService.show('Eliminando permiso...');
    try {
      await firstValueFrom(this.http.delete<ResponseEnvelope<null>>(`/api/permisos/${permiso.id}`));
      this.toastService.success('Permiso eliminado correctamente.');
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  reservado(permiso: Permiso): boolean {
    return (
      !puedeGestionarRol(this.nivelActor(), permiso.idRol) || (!this.esSuperAdmin() && permiso.menu === MENU_CONFIGURACION)
    );
  }

  nombreRol(idRol: number): string {
    return this.roles().find((rol) => rol.id === idRol)?.rol ?? `#${idRol}`;
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

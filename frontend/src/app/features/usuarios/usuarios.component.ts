import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LoadingService } from '../../core/services/loading.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ResponseEnvelope } from '../../core/envelope.model';
import { OpcionRol, Rol } from '../roles/roles.component';
import { capitalizarPrimeraLetra } from '../../core/utils/texto.util';
import { passwordSeguraValidator } from '../../core/validators/password-strength';
import { PasswordFortalezaComponent } from '../../shared/password-fortaleza/password-fortaleza.component';
import { VacioPipe } from '../../shared/pipes/vacio.pipe';
import { nivelRol, puedeGestionarRol } from '../../core/utils/jerarquia-roles.util';
import { TablaResponsivaDirective } from '../../shared/directives/tabla-responsiva.directive';

const MODULO = 'Usuarios';
const ROLES_ADMIN = ['Super Administrador', 'Administrador'];

export interface Usuario {
  id: number;
  numeroDocumento: string;
  usuario: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  numeroContacto: string;
  idRol: number;
  correo: string;
  estadoRegistro: number;
  descripcion: string | null;
  responsable: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  rolRef?: Rol;
}

/** Inserta puntos de miles a medida que se teclea (ver planing/05-reglas-ui-ux.md). */
function formatearNumeroDocumento(valor: string): string {
  const soloDigitos = valor.replace(/\D/g, '');
  return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Número de contacto: 10 dígitos agrupados 3-3-4 a medida que se teclea (ej. `321 256 5689`); mismo formato que guarda el backend. */
function formatearTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 10);
  return [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6)].filter(Boolean).join(' ');
}

const TELEFONO_REGEX = /^\d{3} \d{3} \d{4}$/;

@Component({
  selector: 'app-usuarios',
  imports: [TableModule, ButtonModule, Dialog, ReactiveFormsModule, InputText, Password, Select, Textarea, DatePipe, PasswordFortalezaComponent, VacioPipe, TablaResponsivaDirective],
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly loadingService = inject(LoadingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly permisosService = inject(PermisosService);
  private readonly fb = inject(FormBuilder);

  readonly rows = 10;
  readonly usuarios = signal<Usuario[]>([]);
  readonly total = signal(0);
  readonly roles = signal<OpcionRol[]>([]);

  readonly estados = [
    { label: 'Activo', value: 1 },
    { label: 'Inactivo', value: 0 },
  ];

  readonly puedeCrear = computed(() => this.permisosService.tiene(MODULO, 'Crear'));
  readonly puedeEditar = computed(() => this.permisosService.tiene(MODULO, 'Editar'));
  readonly puedeEliminar = computed(() => this.permisosService.tiene(MODULO, 'Eliminar'));
  readonly puedeResetearPassword = computed(() => ROLES_ADMIN.includes(this.authService.usuario()?.rol ?? ''));
  readonly nivelActor = computed(() => nivelRol(this.authService.usuario()));

  readonly dialogoVisible = signal(false);
  readonly editando = signal<Usuario | null>(null);
  readonly form = this.fb.nonNullable.group({
    numeroDocumento: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(21)]],
    usuario: ['', [Validators.required]],
    primerNombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    segundoNombre: ['', [Validators.minLength(2), Validators.maxLength(45)]],
    primerApellido: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    segundoApellido: ['', [Validators.minLength(2), Validators.maxLength(45)]],
    numeroContacto: ['', [Validators.required, Validators.pattern(TELEFONO_REGEX)]],
    idRol: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    correo: ['', [Validators.required, Validators.email]],
    passwordTemporal: [''],
    estadoRegistro: [1],
    descripcion: ['', [Validators.minLength(3), Validators.maxLength(255)]],
  });

  readonly resetDialogoVisible = signal(false);
  readonly resetUsuario = signal<Usuario | null>(null);
  readonly resetForm = this.fb.nonNullable.group({
    passwordTemporal: ['', [Validators.required, passwordSeguraValidator]],
  });

  ngOnInit(): void {
    void this.cargarRoles();
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

  async cargar(event?: TableLazyLoadEvent): Promise<void> {
    const rows = event?.rows ?? this.rows;
    const page = Math.floor((event?.first ?? 0) / rows) + 1;
    this.loadingService.show('Cargando usuarios...');
    try {
      const params = new HttpParams().set('page', page).set('limit', rows);
      const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<Usuario[]>>('/api/usuarios', { params }));
      this.usuarios.set(respuesta.data ?? []);
      this.total.set(respuesta.pagination?.total ?? 0);
    } catch {
      this.toastService.error('No se pudieron cargar los usuarios.');
    } finally {
      this.loadingService.hide();
    }
  }

  onDocumentoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formateado = formatearNumeroDocumento(input.value);
    this.form.controls.numeroDocumento.setValue(formateado, { emitEvent: false });
    if (!this.editando()) {
      this.form.controls.usuario.setValue(formateado.replace(/\./g, ''), { emitEvent: false });
    }
  }

  onContactoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls.numeroContacto.setValue(formatearTelefono(input.value), { emitEvent: false });
  }

  onDescripcionInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.form.controls.descripcion.setValue(capitalizarPrimeraLetra(input.value), { emitEvent: false });
  }

  onNombreInput(control: 'primerNombre' | 'segundoNombre' | 'primerApellido' | 'segundoApellido', event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.controls[control].setValue(capitalizarPrimeraLetra(input.value), { emitEvent: false });
  }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({
      numeroDocumento: '',
      usuario: '',
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      numeroContacto: '',
      idRol: null,
      correo: '',
      passwordTemporal: '',
      estadoRegistro: 1,
      descripcion: '',
    });
    this.form.controls.passwordTemporal.setValidators([Validators.required, passwordSeguraValidator]);
    this.form.controls.passwordTemporal.updateValueAndValidity();
    this.dialogoVisible.set(true);
  }

  editar(usuario: Usuario): void {
    this.editando.set(usuario);
    this.form.reset({
      numeroDocumento: usuario.numeroDocumento,
      usuario: usuario.usuario,
      primerNombre: usuario.primerNombre,
      segundoNombre: usuario.segundoNombre ?? '',
      primerApellido: usuario.primerApellido,
      segundoApellido: usuario.segundoApellido ?? '',
      numeroContacto: formatearTelefono(usuario.numeroContacto),
      idRol: usuario.idRol,
      correo: usuario.correo,
      passwordTemporal: '',
      estadoRegistro: usuario.estadoRegistro,
      descripcion: usuario.descripcion ?? '',
    });
    this.form.controls.passwordTemporal.clearValidators();
    this.form.controls.passwordTemporal.updateValueAndValidity();
    this.dialogoVisible.set(true);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const actual = this.editando();
    const { passwordTemporal, descripcion, ...datos } = this.form.getRawValue();
    const cuerpo: Record<string, unknown> = { ...datos, descripcion: descripcion?.trim() || undefined };
    if (!actual) {
      delete cuerpo['estadoRegistro'];
    }
    this.loadingService.show(actual ? 'Actualizando usuario...' : 'Creando usuario...');
    try {
      if (actual) {
        await firstValueFrom(this.http.patch<ResponseEnvelope<Usuario>>(`/api/usuarios/${actual.id}`, cuerpo));
      } else {
        await firstValueFrom(this.http.post<ResponseEnvelope<Usuario>>('/api/usuarios', { ...cuerpo, passwordTemporal }));
      }
      this.toastService.success(actual ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
      this.dialogoVisible.set(false);
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  async eliminar(usuario: Usuario): Promise<void> {
    if (!(await this.confirmService.eliminar())) {
      return;
    }
    this.loadingService.show('Eliminando usuario...');
    try {
      await firstValueFrom(this.http.delete<ResponseEnvelope<null>>(`/api/usuarios/${usuario.id}`));
      this.toastService.success('Usuario eliminado correctamente.');
      await this.cargar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  abrirReseteo(usuario: Usuario): void {
    this.resetUsuario.set(usuario);
    this.resetForm.reset({ passwordTemporal: '' });
    this.resetDialogoVisible.set(true);
  }

  async confirmarReseteo(): Promise<void> {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    const usuario = this.resetUsuario();
    if (!usuario) {
      return;
    }
    const { passwordTemporal } = this.resetForm.getRawValue();
    this.loadingService.show('Asignando contraseña temporal...');
    try {
      await firstValueFrom(
        this.http.post<ResponseEnvelope<null>>(`/api/auth/resetear-password/${usuario.id}`, { passwordTemporal }),
      );
      this.toastService.success('Contraseña temporal asignada correctamente.');
      this.resetDialogoVisible.set(false);
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.loadingService.hide();
    }
  }

  /** Usuarios de un rol por encima del propio: no se editan, eliminan ni se les restablece la contraseña. */
  reservado(usuario: Usuario): boolean {
    return !puedeGestionarRol(this.nivelActor(), usuario.idRol);
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

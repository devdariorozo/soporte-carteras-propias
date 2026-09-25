import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Dialog } from 'primeng/dialog';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/services/auth.service';
import { LoadingService } from '../../core/services/loading.service';
import { ToastService } from '../../core/services/toast.service';
import { CambiarPasswordUiService } from '../../core/services/cambiar-password-ui.service';
import { ResponseEnvelope } from '../../core/envelope.model';
import { passwordSeguraValidator } from '../../core/validators/password-strength';
import { PasswordFortalezaComponent } from '../password-fortaleza/password-fortaleza.component';

/** `passwordNueva` y `passwordConfirmar` deben coincidir — solo se evalúa una vez se llenó la confirmación. */
function passwordsCoincidenValidator(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('passwordNueva')?.value;
  const confirmar = grupo.get('passwordConfirmar')?.value;
  return !confirmar || nueva === confirmar ? null : { noCoincide: true };
}

/**
 * Modal global de cambio de contraseña (ver `app.html`): se abre solo mientras
 * `debeCambiarPassword` sea `true` (primer acceso o post-reseteo-asistido, sin poder
 * cerrarse) o cuando el usuario lo pide voluntariamente desde la nav bar
 * (`CambiarPasswordUiService`).
 */
@Component({
  selector: 'app-cambiar-password-modal',
  imports: [ReactiveFormsModule, Dialog, Password, Button, PasswordFortalezaComponent],
  templateUrl: './cambiar-password-modal.component.html',
})
export class CambiarPasswordModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly loadingService = inject(LoadingService);
  private readonly toastService = inject(ToastService);
  protected readonly ui = inject(CambiarPasswordUiService);

  /** Primer acceso o post-reseteo-asistido: el modal no se puede cerrar (06-seguridad-sesion.md). */
  readonly forzado = computed(() => this.authService.usuario()?.debeCambiarPassword ?? false);
  readonly visible = computed(() => this.forzado() || this.ui.abiertoManualmente());

  readonly form = this.fb.nonNullable.group(
    {
      passwordActual: ['', [Validators.required]],
      passwordNueva: ['', [Validators.required, passwordSeguraValidator]],
      passwordConfirmar: ['', [Validators.required]],
      secretoNuevo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    },
    { validators: [passwordsCoincidenValidator] },
  );

  /** Evita doble envío mientras la petición está en curso. */
  readonly enviando = signal(false);

  onVisibleChange(valor: boolean): void {
    if (!valor && !this.forzado()) {
      this.cerrarYLimpiar();
    }
  }

  async enviar(): Promise<void> {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }

    const { passwordActual, passwordNueva, secretoNuevo } = this.form.getRawValue();
    this.enviando.set(true);
    this.loadingService.show('Actualizando contraseña...');
    try {
      await this.authService.cambiarPassword(passwordActual, passwordNueva, secretoNuevo);
      this.toastService.success('Contraseña actualizada correctamente.');
      this.cerrarYLimpiar();
    } catch (error) {
      this.toastService.error(this.extraerMensaje(error));
    } finally {
      this.enviando.set(false);
      this.loadingService.hide();
    }
  }

  private cerrarYLimpiar(): void {
    this.ui.cerrar();
    this.form.reset();
  }

  private extraerMensaje(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const envelope = error.error as ResponseEnvelope | undefined;
      if (envelope?.message) {
        return envelope.message;
      }
    }
    return 'No se pudo actualizar la contraseña, intenta de nuevo.';
  }
}

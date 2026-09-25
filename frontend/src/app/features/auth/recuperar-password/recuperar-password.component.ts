import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ToastService } from '../../../core/services/toast.service';
import { ResponseEnvelope } from '../../../core/envelope.model';
import { passwordSeguraValidator } from '../../../core/validators/password-strength';
import { PasswordFortalezaComponent } from '../../../shared/password-fortaleza/password-fortaleza.component';
import { esLimiteExcedido } from '../../../core/utils/limite-excedido.util';

@Component({
  selector: 'app-recuperar-password',
  imports: [ReactiveFormsModule, RouterLink, Card, InputText, Password, Button, PasswordFortalezaComponent],
  templateUrl: './recuperar-password.component.html',
})
export class RecuperarPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly loadingService = inject(LoadingService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);


  readonly form = this.fb.nonNullable.group({
    usuario: ['', [Validators.required]],
    secreto: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(45)]],
    passwordNueva: ['', [Validators.required, passwordSeguraValidator]],
  });

  async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { usuario, secreto, passwordNueva } = this.form.getRawValue();
    this.loadingService.show('Recuperando contraseña...');
    try {
      await this.authService.recuperarPassword(usuario, secreto, passwordNueva);
      this.toastService.success('Contraseña recuperada, ya puedes iniciar sesión.');
      await this.router.navigateByUrl('/login');
    } catch (error) {
      if (esLimiteExcedido(error)) {
        this.toastService.warning(this.extraerMensaje(error));
      } else {
        this.toastService.error(this.extraerMensaje(error));
      }
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
    return 'No se pudo recuperar la contraseña, intenta de nuevo.';
  }
}

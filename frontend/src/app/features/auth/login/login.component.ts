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
import { esLimiteExcedido } from '../../../core/utils/limite-excedido.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Card, InputText, Password, Button],
  templateUrl: './login.component.html',
  // PrimeNG no expone un input para el gap entre `.p-card-subtitle` y `.p-card-content`
  // dentro de `p-card` — ::ng-deep acotado a esta tarjeta es la única forma de tocarlo.
  styles: [
    `
      :host ::ng-deep .scp-login-card .p-card-subtitle {
        margin-bottom: 3px;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly loadingService = inject(LoadingService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    usuario: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { usuario, password } = this.form.getRawValue();
    this.loadingService.show('Iniciando sesión...');
    try {
      await this.authService.login(usuario, password);
      this.toastService.success('Inicio de sesión exitoso.');
      // Si debeCambiarPassword sigue en true, el modal global (ver app.html) se abre
      // solo sobre esta misma página de inicio — no hay una ruta dedicada.
      await this.router.navigateByUrl('/');
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
    return 'No se pudo iniciar sesión, intenta de nuevo.';
  }
}

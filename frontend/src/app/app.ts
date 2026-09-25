import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ProgressSpinner } from 'primeng/progressspinner';
import { LoadingService } from './core/services/loading.service';
import { AuthService } from './core/services/auth.service';
import { LayoutService } from './core/services/layout.service';
import { NavBarComponent } from './shared/nav-bar/nav-bar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { CambiarPasswordModalComponent } from './shared/cambiar-password-modal/cambiar-password-modal.component';

@Component({
  imports: [
    RouterOutlet,
    Toast,
    ConfirmDialog,
    ProgressSpinner,
    NavBarComponent,
    FooterComponent,
    CambiarPasswordModalComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly loadingService = inject(LoadingService);
  protected readonly layoutService = inject(LayoutService);
  private readonly authService = inject(AuthService);

  /** Oculta la nav bar mientras falta el cambio de contraseña obligatorio (el backend bloquea todo lo demás). */
  protected readonly mostrarNavBar = computed(
    () => this.authService.isAuthenticated() && !this.authService.usuario()?.debeCambiarPassword,
  );
}

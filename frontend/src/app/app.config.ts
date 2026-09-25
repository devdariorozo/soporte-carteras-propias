import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withNavigationErrorHandler } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './core/interceptors/api-base-url.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { timeoutInterceptor } from './core/interceptors/timeout.interceptor';
import { AuthService } from './core/services/auth.service';
import { PermisosService } from './core/services/permisos.service';
import { recargarSiCambioLaVersion } from './core/utils/recarga-version.util';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Tras un despliegue, si la pantalla pedida ya no existe en el servidor, recarga una vez con la versión nueva.
    provideRouter(routes, withNavigationErrorHandler(recargarSiCambioLaVersion)),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor, authInterceptor, timeoutInterceptor])),
    providePrimeNG({
      theme: { preset: Aura, options: { darkModeSelector: '.dark' } },
      translation: {
        weak: 'Débil',
        medium: 'Media',
        strong: 'Fuerte',
        passwordPrompt: 'Ingresa una contraseña',
        accept: 'Sí',
        reject: 'No',
      },
    }),
    MessageService,
    ConfirmationService,
    // Si ya hay sesión al recargar la página, carga los permisos antes de que el
    // router evalúe la primera ruta. Se hace aquí (no en el constructor de
    // AuthService) porque en ese punto la inyección de AuthService ya terminó,
    // evitando el NG0200 (dependencia circular) que dispara el interceptor HTTP al
    // volver a inyectar AuthService para leer el token.
    // Antes, confirma con el backend que la sesión guardada siga viva
    // (`validarSesionGuardada`); si no, la limpia y la primera ruta manda al login.
    provideAppInitializer(async () => {
      const authService = inject(AuthService);
      const permisosService = inject(PermisosService);
      await authService.validarSesionGuardada();
      // El refresh de `validarSesionGuardada` ya disparó la carga de permisos (si no
      // debe cambiar la contraseña); se espera para que el router decida con ellos.
      await permisosService.esperarCarga();
    }),
  ],
};

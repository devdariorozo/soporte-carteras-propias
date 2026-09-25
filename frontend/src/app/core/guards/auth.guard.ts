import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard simple de "¿hay sesión?" (Fase 1). El menú/acceso armado a partir de
 * `permisos` por fila es explícitamente Fase 2 — no se adelanta aquí.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

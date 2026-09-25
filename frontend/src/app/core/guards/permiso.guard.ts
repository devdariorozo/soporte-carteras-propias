import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermisosService } from '../services/permisos.service';

/**
 * Bloquea la ruta si el rol del usuario autenticado no tiene `Consultar` sobre ese
 * módulo. Espera la carga de `mis-permisos` en curso (relevante en una recarga de
 * página: `authGuard` corre primero y ya disparó `AuthService` → `cargar()`, pero es
 * asíncrono) antes de decidir.
 */
export const permisoGuard = (modulo: string, accion = 'Consultar'): CanActivateFn => {
  return async () => {
    const permisosService = inject(PermisosService);
    const router = inject(Router);
    await permisosService.esperarCarga();
    return permisosService.tiene(modulo, accion) ? true : router.createUrlTree(['/']);
  };
};

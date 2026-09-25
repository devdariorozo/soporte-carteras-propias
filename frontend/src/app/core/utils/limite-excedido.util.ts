import { HttpErrorResponse } from '@angular/common/http';

/**
 * 429 = se superó un límite (intentos fallidos de login / recuperar contraseña, o ejecuciones
 * por minuto de Soporte). No es un error del usuario ni del sistema: se muestra como
 * advertencia (amarillo) con el mensaje del backend, que dice cuánto esperar.
 */
export function esLimiteExcedido(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 429;
}

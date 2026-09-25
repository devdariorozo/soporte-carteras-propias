import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** No llevan el JWT ni disparan la renovación automática ante un 401. */
const RUTAS_PUBLICAS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/recuperar-password'];
/** Llevan el JWT pero un 401 no se reintenta (cerrar sesión con un token ya inválido no tiene nada que renovar). */
const SIN_REINTENTO = ['/api/auth/logout'];

/** Marca la petición ya reintentada tras renovar la sesión, para no entrar en un ciclo. */
const REINTENTADA = new HttpContextToken<boolean>(() => false);

/**
 * Pone el JWT en cada petición. Ante un 401 (token vencido, por ejemplo al volver tras un
 * rato sin usar el sistema), renueva la sesión con el refresh token y reintenta una vez; solo
 * si la renovación también es rechazada se cierra la sesión (lo hace `renovarParaReintentar`).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const esPublica = RUTAS_PUBLICAS.some((ruta) => req.url.includes(ruta));
  const sinReintento = esPublica || SIN_REINTENTO.some((ruta) => req.url.includes(ruta));

  const conToken = (token: string | null) =>
    !esPublica && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  const tokenUsado = authService.getAccessToken();
  return next(conToken(tokenUsado)).pipe(
    catchError((error: unknown) => {
      const debeRenovar =
        error instanceof HttpErrorResponse && error.status === 401 && !sinReintento && !req.context.get(REINTENTADA);
      if (!debeRenovar) {
        return throwError(() => error);
      }
      return from(authService.renovarParaReintentar(tokenUsado)).pipe(
        switchMap((token) => next(conToken(token).clone({ context: req.context.set(REINTENTADA, true) }))),
        catchError(() => throwError(() => error)),
      );
    }),
  );
};

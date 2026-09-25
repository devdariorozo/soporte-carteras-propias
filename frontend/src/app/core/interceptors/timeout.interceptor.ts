import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

const TIMEOUT_MS = 20_000;

/** Si el backend no responde en 20s (ej. CORS/red colgada), la petición falla en vez de
 * dejar el preloader global visible para siempre (ver `LoadingService`). */
export const timeoutInterceptor: HttpInterceptorFn = (req, next) => next(req).pipe(timeout(TIMEOUT_MS));

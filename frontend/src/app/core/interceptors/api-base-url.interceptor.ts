import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Con `environment.apiUrl` vacío (valor actual en todos los ambientes) las llamadas `/api`
 * van al mismo origen: `ng serve` las resuelve con `proxy.conf.json` y en Docker las
 * reenvía nginx. Si algún día se define una URL absoluta, aquí se antepone a cada `/api/...`.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.apiUrl || !req.url.startsWith('/api')) {
    return next(req);
  }
  return next(req.clone({ url: `${environment.apiUrl}${req.url}` }));
};

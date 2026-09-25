import { Injectable, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

/** Desde este ancho (Tailwind `lg`) el menú es un sidebar fijo; por debajo, un panel que se abre con la hamburguesa. */
const MEDIA_ESCRITORIO = '(min-width: 1024px)';
const CLAVE_COLAPSADO = 'scp.menuColapsado';

function leerColapsado(): boolean {
  try {
    return localStorage.getItem(CLAVE_COLAPSADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Estado del menú lateral: en escritorio se puede colapsar a solo íconos (se recuerda en el
 * navegador); en tablet y móvil se abre y cierra como panel sobre el contenido.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly esEscritorio = toSignal(
    inject(BreakpointObserver)
      .observe(MEDIA_ESCRITORIO)
      .pipe(map((estado) => estado.matches)),
    { initialValue: window.matchMedia(MEDIA_ESCRITORIO).matches },
  );

  readonly colapsado = signal(leerColapsado());
  readonly menuMovilAbierto = signal(false);

  alternarColapsado(): void {
    this.colapsado.update((valor) => !valor);
    try {
      localStorage.setItem(CLAVE_COLAPSADO, this.colapsado() ? '1' : '0');
    } catch {
      // Sin almacenamiento (modo privado): el estado solo dura la sesión.
    }
  }

  abrirMenuMovil(): void {
    this.menuMovilAbierto.set(true);
  }

  cerrarMenuMovil(): void {
    this.menuMovilAbierto.set(false);
  }
}

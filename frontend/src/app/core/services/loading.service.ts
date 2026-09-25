import { Injectable, signal } from '@angular/core';

/**
 * Estado global del preloader (overlay + mensaje de progreso, ver `app.html` y
 * planing/05-reglas-ui-ux.md) — una vista llama `show`/`hide` en vez de manejar su
 * propio spinner local. El overlay se renderiza con `@if` sobre esta señal (no con
 * `p-blockui`): ese componente oculta su contenido mediante un evento CSS
 * `animationend`, y si esa animación no llega a dispararse en el navegador (ej.
 * `prefers-reduced-motion`), el spinner se queda visible para siempre aunque
 * `visible` ya sea `false`.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  readonly visible = signal(false);
  readonly mensaje = signal('');

  show(mensaje: string): void {
    this.mensaje.set(mensaje);
    this.visible.set(true);
  }

  hide(): void {
    this.visible.set(false);
  }
}

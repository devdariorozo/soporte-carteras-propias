import { Injectable, signal } from '@angular/core';

/** Abre/cierra el modal de cambio de contraseña voluntario (el obligatorio se dispara solo, ver `CambiarPasswordModalComponent`). */
@Injectable({ providedIn: 'root' })
export class CambiarPasswordUiService {
  readonly abiertoManualmente = signal(false);

  abrir(): void {
    this.abiertoManualmente.set(true);
  }

  cerrar(): void {
    this.abiertoManualmente.set(false);
  }
}

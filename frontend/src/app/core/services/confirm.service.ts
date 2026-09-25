import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

/**
 * Envuelve `ConfirmationService`/`p-confirmDialog` para la única confirmación que
 * queda en el sistema: eliminar (ver plan de trabajo — "actualizar" ya no pregunta).
 * Botón "No" en verde (severity success) y "Sí" en rojo (severity danger); la alerta
 * completa se pinta en amarillo vía `.confirmar-eliminar` (app.html / styles.scss).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly confirmationService = inject(ConfirmationService);

  eliminar(): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationService.confirm({
        message: '¿Estás seguro de querer eliminar este registro?',
        header: 'Confirmar',
        icon: 'pi pi-exclamation-triangle',
        acceptButtonProps: { label: 'Sí', severity: 'danger' },
        rejectButtonProps: { label: 'No', severity: 'success' },
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }
}

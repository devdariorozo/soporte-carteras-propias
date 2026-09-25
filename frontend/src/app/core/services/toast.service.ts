import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * Envuelve `MessageService`/`p-toast` con los 4 tipos ya definidos en
 * planing/05-reglas-ui-ux.md, para no repetir el mapeo de severidad en cada vista.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messageService = inject(MessageService);

  success(message: string, title = 'Éxito'): void {
    this.messageService.add({ severity: 'success', summary: title, detail: message });
  }

  error(message: string, title = 'Error'): void {
    this.messageService.add({ severity: 'error', summary: title, detail: message });
  }

  warning(message: string, title = 'Atención'): void {
    this.messageService.add({ severity: 'warn', summary: title, detail: message });
  }

  info(message: string, title = 'Información'): void {
    this.messageService.add({ severity: 'info', summary: title, detail: message });
  }
}

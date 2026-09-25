import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ResponseEnvelope } from '../envelope.model';

export interface PermisoUsuario {
  menu: string;
  permiso: string;
}

/**
 * Permisos (menu + acción) del rol del usuario autenticado — arma el gating de
 * cada vista (botones Crear/Editar/Eliminar, guard de rutas). Fuente de verdad:
 * `GET /api/permisos/mis-permisos` (ver planing/03-modelo-datos.md).
 */
@Injectable({ providedIn: 'root' })
export class PermisosService {
  private readonly http = inject(HttpClient);
  private readonly permisos = signal<PermisoUsuario[]>([]);
  private cargaEnCurso: Promise<void> | null = null;

  /** Dispara la carga y devuelve la promesa (no bloqueante para quien no necesite esperarla). */
  cargar(): Promise<void> {
    this.cargaEnCurso = this.cargarInterno();
    return this.cargaEnCurso;
  }

  /**
   * Espera la carga en curso (si hay una) antes de que un guard decida — sin esto,
   * en una recarga de página el guard podría correr antes de que termine el fetch
   * async y bloquear al usuario aunque sí tenga el permiso (ver el
   * `provideAppInitializer` en app.config.ts).
   */
  async esperarCarga(): Promise<void> {
    if (this.cargaEnCurso) {
      await this.cargaEnCurso;
    }
  }

  limpiar(): void {
    this.permisos.set([]);
    this.cargaEnCurso = null;
  }

  tiene(menu: string, accion: string): boolean {
    return this.permisos().some((p) => p.menu === menu && p.permiso === accion);
  }

  private async cargarInterno(): Promise<void> {
    try {
      const respuesta = await firstValueFrom(
        this.http.get<ResponseEnvelope<PermisoUsuario[]>>('/api/permisos/mis-permisos'),
      );
      this.permisos.set(respuesta.data ?? []);
    } catch {
      this.permisos.set([]);
    } finally {
      this.cargaEnCurso = null;
    }
  }
}

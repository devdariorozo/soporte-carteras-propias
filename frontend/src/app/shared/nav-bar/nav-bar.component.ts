import { Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { filter, firstValueFrom } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Menu } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tooltip } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { PermisosService } from '../../core/services/permisos.service';
import { CambiarPasswordUiService } from '../../core/services/cambiar-password-ui.service';
import { LayoutService } from '../../core/services/layout.service';
import { ResponseEnvelope } from '../../core/envelope.model';

interface OpcionMenu {
  apartado: string;
  menu: string;
  ruta: string;
  icono: string;
  orden: number;
}

interface ApartadoMenu {
  apartado: string;
  opciones: OpcionMenu[];
}

/**
 * Sidebar transversal (ver planing/05-reglas-ui-ux.md): saludo, menú por permisos, ayuda y usuario.
 * Escritorio: fijo, colapsable a solo íconos. Tablet y móvil: panel que abre la hamburguesa
 * (ver `app.html`) y se cierra al navegar, al tocar fuera o con Escape.
 */
@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive, Menu, ButtonModule, Dialog, Tooltip],
  templateUrl: './nav-bar.component.html',
})
export class NavBarComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly permisosService = inject(PermisosService);
  private readonly cambiarPasswordUi = inject(CambiarPasswordUiService);
  readonly layout = inject(LayoutService);

  readonly usuario = this.authService.usuario;
  /** Solo íconos: colapsado en escritorio. En el panel móvil siempre se ven los nombres. */
  readonly compacto = computed(() => this.layout.esEscritorio() && this.layout.colapsado());
  /** Móvil: fuera de pantalla salvo que esté abierto. Escritorio: ancho completo o solo íconos. */
  readonly clasesAside = computed(
    () => `${this.layout.menuMovilAbierto() ? 'translate-x-0' : '-translate-x-full'} ${this.compacto() ? 'lg:w-20' : 'lg:w-64'}`,
  );
  readonly ayudaVisible = signal(false);

  private readonly opcionesMenu = signal<OpcionMenu[]>([]);

  readonly apartados = computed<ApartadoMenu[]>(() => {
    const grupos = new Map<string, OpcionMenu[]>();
    for (const opcion of this.opcionesMenu()) {
      if (!this.puedeVer(opcion.menu)) {
        continue;
      }
      const lista = grupos.get(opcion.apartado) ?? [];
      lista.push(opcion);
      grupos.set(opcion.apartado, lista);
    }
    return [...grupos.entries()].map(([apartado, opciones]) => ({ apartado, opciones }));
  });

  readonly itemsUsuario: MenuItem[] = [
    {
      label: 'Actualizar contraseña',
      icon: 'pi pi-key',
      command: () => this.cambiarPasswordUi.abrir(),
    },
    {
      label: 'Cerrar sesión',
      icon: 'pi pi-sign-out',
      command: () => void this.authService.logout(),
    },
  ];

  constructor() {
    inject(Router)
      .events.pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.layout.cerrarMenuMovil());
    // Al pasar a escritorio el panel móvil no tiene sentido abierto.
    effect(() => {
      if (this.layout.esEscritorio()) {
        this.layout.cerrarMenuMovil();
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.layout.cerrarMenuMovil();
  }

  ngOnInit(): void {
    void this.cargarMenu();
  }

  private async cargarMenu(): Promise<void> {
    try {
      const respuesta = await firstValueFrom(this.http.get<ResponseEnvelope<OpcionMenu[]>>('/api/menu/activos'));
      this.opcionesMenu.set(respuesta.data ?? []);
    } catch {
      this.opcionesMenu.set([]);
    }
  }

  puedeVer(modulo: string): boolean {
    return this.permisosService.tiene(modulo, 'Consultar');
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ResponseEnvelope } from '../envelope.model';
import { PermisosService } from './permisos.service';

const ACCESS_TOKEN_KEY = 'scp_access_token';
const REFRESH_TOKEN_KEY = 'scp_refresh_token';
const USUARIO_KEY = 'scp_usuario';
/** Un poco antes de los 15 min de vida del access token (planing/06-seguridad-sesion.md). */
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;
/** Al volver a la pestaña, si al access token le queda menos que esto, se renueva de una vez. */
const MARGEN_RENOVACION_MS = 2 * 60 * 1000;

/** Vencimiento (ms) de un JWT leyendo su `exp`, o 0 si no se puede leer. */
function vencimientoToken(token: string | null): number {
  try {
    const payload = JSON.parse(atob((token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** 401 del backend = la sesión ya no sirve; cualquier otro error (red, 5xx) es pasajero. */
function esSesionInvalida(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 401;
}

export interface UsuarioAutenticado {
  id: number;
  usuario: string;
  primerNombre: string;
  primerApellido: string;
  rol: string;
  idRol?: number;
  debeCambiarPassword: boolean;
}

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  usuario?: UsuarioAutenticado;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly permisosService = inject(PermisosService);

  private readonly accessToken = signal<string | null>(this.leerStorage(ACCESS_TOKEN_KEY));
  private readonly refreshTokenValue = signal<string | null>(this.leerStorage(REFRESH_TOKEN_KEY));
  readonly usuario = signal<UsuarioAutenticado | null>(this.leerUsuarioStorage());
  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  private refreshTimerId: ReturnType<typeof setInterval> | null = null;
  /** Una sola renovación a la vez: cada renovación invalida el token anterior, así que no pueden solaparse. */
  private refreshEnCurso: Promise<void> | null = null;

  constructor() {
    // Con el equipo suspendido o la pestaña en segundo plano el navegador congela el
    // temporizador: al volver, se renueva de inmediato si el token está por vencer.
    const alVolver = () => void this.renovarSiEstaPorVencer();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') alVolver();
    });
    window.addEventListener('focus', alVolver);
    window.addEventListener('online', alVolver);
    // Varias pestañas comparten la sesión en localStorage: cuando otra pestaña renueva, inicia o
    // cierra sesión, esta toma los mismos datos (el evento solo llega a las demás pestañas).
    window.addEventListener('storage', (evento) => {
      if (evento.key === null || [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USUARIO_KEY].includes(evento.key)) {
        this.sincronizarDesdeOtraPestana();
      }
    });

    if (this.accessToken()) {
      this.programarRefresh();
      // La carga inicial de permisos (si ya hay sesión al recargar la página) la
      // dispara el APP_INITIALIZER en app.config.ts, no este constructor: si se
      // llamara aquí, el interceptor HTTP re-inyecta AuthService para leer el token
      // mientras este constructor todavía no ha terminado de ejecutarse -> NG0200
      // (dependencia circular).
    }
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  async login(usuario: string, password: string): Promise<UsuarioAutenticado> {
    const respuesta = await firstValueFrom(
      this.http.post<ResponseEnvelope<TokensResponse>>('/api/auth/login', { usuario, password }),
    );
    const data = respuesta.data as TokensResponse;
    this.guardarSesion(data);
    return data.usuario as UsuarioAutenticado;
  }

  /** Renueva la sesión; si ya hay una renovación en curso, espera esa misma en vez de lanzar otra. */
  refresh(): Promise<void> {
    if (!this.refreshEnCurso) {
      this.refreshEnCurso = this.refreshInterno().finally(() => {
        this.refreshEnCurso = null;
      });
    }
    return this.refreshEnCurso;
  }

  /**
   * Usado por el interceptor ante un 401: renueva y devuelve el token nuevo para reintentar.
   * Si la renovación también es rechazada (401), la sesión terminó de verdad: se cierra.
   */
  async renovarParaReintentar(tokenUsado: string | null): Promise<string> {
    // Si otra pestaña ya renovó, basta con reintentar con su token (sin pedir otro).
    this.adoptarTokensDeStorage();
    if (this.accessToken() && this.accessToken() !== tokenUsado) {
      return this.accessToken() as string;
    }
    try {
      await this.refresh();
    } catch (error) {
      if (esSesionInvalida(error) || !this.refreshTokenValue()) {
        await this.salirAlLogin();
      }
      throw error;
    }
    return this.accessToken() as string;
  }

  private async renovarSiEstaPorVencer(): Promise<void> {
    if (!this.refreshTokenValue() || this.usuario()?.debeCambiarPassword) {
      return;
    }
    if (vencimientoToken(this.accessToken()) - Date.now() > MARGEN_RENOVACION_MS) {
      return;
    }
    await this.refresh().catch((error: unknown) => {
      if (esSesionInvalida(error)) {
        void this.logout();
      }
    });
  }

  /**
   * Cada renovación invalida el refresh token anterior, así que entre pestañas no pueden
   * pisarse: se serializan con Web Locks (si el navegador lo soporta) y, dentro, se revisa si
   * otra pestaña ya renovó. Si aun así el backend rechaza el token porque otra pestaña ganó la
   * carrera, se adoptan los tokens nuevos en vez de cerrar la sesión.
   */
  private async refreshInterno(): Promise<void> {
    const conCandado = <T>(tarea: () => Promise<T>): Promise<T> =>
      navigator.locks?.request ? (navigator.locks.request('scp-refresh', tarea) as Promise<T>) : tarea();

    await conCandado(async () => {
      const enMemoria = this.refreshTokenValue();
      const enStorage = this.leerStorage(REFRESH_TOKEN_KEY);
      if (enStorage && enStorage !== enMemoria) {
        this.adoptarTokensDeStorage();
        return;
      }
      const refreshToken = enStorage ?? enMemoria;
      if (!refreshToken) {
        throw new Error('No hay refresh token activo.');
      }
      try {
        const respuesta = await firstValueFrom(
          this.http.post<ResponseEnvelope<TokensResponse>>('/api/auth/refresh', { refreshToken }),
        );
        this.guardarSesion(respuesta.data as TokensResponse);
      } catch (error) {
        const ahora = this.leerStorage(REFRESH_TOKEN_KEY);
        if (esSesionInvalida(error) && ahora && ahora !== refreshToken) {
          this.adoptarTokensDeStorage();
          return;
        }
        throw error;
      }
    });
  }

  /** Toma de localStorage los tokens y el usuario que dejó otra pestaña. */
  private adoptarTokensDeStorage(): void {
    const access = this.leerStorage(ACCESS_TOKEN_KEY);
    const refresh = this.leerStorage(REFRESH_TOKEN_KEY);
    if (!access || !refresh) {
      return;
    }
    this.accessToken.set(access);
    this.refreshTokenValue.set(refresh);
    const usuario = this.leerUsuarioStorage();
    if (usuario) {
      this.usuario.set(usuario);
    }
  }

  /** Otra pestaña cambió la sesión: si la cerró, esta también; si la renovó o inició, se adoptan sus datos. */
  private sincronizarDesdeOtraPestana(): void {
    if (!this.leerStorage(ACCESS_TOKEN_KEY) || !this.leerStorage(REFRESH_TOKEN_KEY)) {
      if (this.accessToken()) {
        void this.salirAlLogin();
      }
      return;
    }
    const cambioDeUsuario = this.leerUsuarioStorage()?.id !== this.usuario()?.id;
    this.adoptarTokensDeStorage();
    if (cambioDeUsuario) {
      void this.permisosService.cargar();
    }
    if (!this.refreshTimerId) {
      this.programarRefresh();
    }
  }

  /**
   * Al abrir la app con una sesión guardada, la confirma con el backend (refresh) antes
   * de usarla: si ya no es válida (sesión cerrada, BD reconstruida, usuario inactivo),
   * se limpia y el usuario pasa por el login en vez de ver pantallas de una sesión muerta.
   */
  async validarSesionGuardada(): Promise<void> {
    if (!this.refreshTokenValue()) {
      if (this.accessToken() || this.usuario()) {
        this.limpiarSesionLocal();
      }
      return;
    }
    try {
      await this.refresh();
    } catch {
      this.limpiarSesionLocal();
    }
  }

  async cambiarPassword(passwordActual: string, passwordNueva: string, secretoNuevo: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ResponseEnvelope<null>>('/api/auth/cambiar-password', {
        passwordActual,
        passwordNueva,
        secretoNuevo,
      }),
    );
    // El access token vigente sigue llevando `debeCambiarPassword: true` (es un claim
    // firmado, no se actualiza solo) — sin este refresh, JwtAuthGuard seguiría
    // bloqueando cualquier otro endpoint con ese token viejo.
    await this.refresh();
    const actual = this.usuario();
    if (actual) {
      const actualizado: UsuarioAutenticado = { ...actual, debeCambiarPassword: false };
      this.usuario.set(actualizado);
      localStorage.setItem(USUARIO_KEY, JSON.stringify(actualizado));
    }
  }

  async recuperarPassword(usuario: string, secreto: string, passwordNueva: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ResponseEnvelope<null>>('/api/auth/recuperar-password', { usuario, secreto, passwordNueva }),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<ResponseEnvelope<null>>('/api/auth/logout', {}));
    } catch {
      // Si el token ya no era válido, igual limpiamos la sesión local.
    } finally {
      await this.salirAlLogin();
    }
  }

  /**
   * Primero navega al login y después limpia la sesión. Al revés, el layout pasa del
   * `router-outlet` con barra de navegación al que no la tiene y vuelve a crear la pantalla
   * actual (ej. Informes), que alcanza a pedir datos sin token (401 y avisos de error).
   */
  private async salirAlLogin(): Promise<void> {
    await this.router.navigateByUrl('/login');
    this.limpiarSesionLocal();
  }

  /** Limpia el estado local sin llamar al backend — usado por el interceptor ante un 401. */
  limpiarSesionLocal(): void {
    this.accessToken.set(null);
    this.refreshTokenValue.set(null);
    this.usuario.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    this.permisosService.limpiar();
    if (this.refreshTimerId) {
      clearInterval(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private guardarSesion(data: TokensResponse): void {
    this.accessToken.set(data.accessToken);
    this.refreshTokenValue.set(data.refreshToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    if (data.usuario) {
      this.usuario.set(data.usuario);
      localStorage.setItem(USUARIO_KEY, JSON.stringify(data.usuario));
    }
    this.programarRefresh();
    // Mientras debeCambiarPassword sea true, el backend bloquea este endpoint también
    // (JwtAuthGuard) — se dispara solo cuando ya puede resolver en 200 (tras el cambio
    // de contraseña, `cambiarPassword()` llama a `refresh()`, que vuelve a pasar por acá).
    if (!data.usuario?.debeCambiarPassword) {
      void this.permisosService.cargar();
    }
  }

  private programarRefresh(): void {
    if (this.refreshTimerId) {
      clearInterval(this.refreshTimerId);
    }
    this.refreshTimerId = setInterval(() => {
      // Un fallo de red no cierra la sesión: se reintenta en el próximo ciclo o al volver a la pestaña.
      this.refresh().catch((error: unknown) => {
        if (esSesionInvalida(error)) {
          void this.logout();
        }
      });
    }, REFRESH_INTERVAL_MS);
  }

  private leerStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private leerUsuarioStorage(): UsuarioAutenticado | null {
    try {
      const raw = localStorage.getItem(USUARIO_KEY);
      return raw ? (JSON.parse(raw) as UsuarioAutenticado) : null;
    } catch {
      return null;
    }
  }
}

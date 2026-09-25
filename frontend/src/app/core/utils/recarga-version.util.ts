import { NavigationError } from '@angular/router';

const CLAVE_ULTIMA_RECARGA = 'scp_recarga_version';
/** Evita un ciclo de recargas si el archivo realmente no existe (no es un tema de versión). */
const ESPERA_ENTRE_RECARGAS_MS = 10_000;

const ERRORES_CARGA_MODULO = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i;

/**
 * Tras un despliegue, una pestaña abierta con la versión anterior pide pantallas (chunks)
 * que ya no existen. En ese caso se recarga la página una vez para tomar la versión nueva.
 */
export function recargarSiCambioLaVersion(evento: NavigationError): void {
  const mensaje = evento.error instanceof Error ? evento.error.message : String(evento.error ?? '');
  if (!ERRORES_CARGA_MODULO.test(mensaje)) {
    return;
  }
  let ultima = 0;
  try {
    ultima = Number(sessionStorage.getItem(CLAVE_ULTIMA_RECARGA) ?? 0);
    if (Date.now() - ultima < ESPERA_ENTRE_RECARGAS_MS) {
      return;
    }
    sessionStorage.setItem(CLAVE_ULTIMA_RECARGA, String(Date.now()));
  } catch {
    // Sin sessionStorage igual se intenta la recarga.
  }
  window.location.assign(evento.url);
}

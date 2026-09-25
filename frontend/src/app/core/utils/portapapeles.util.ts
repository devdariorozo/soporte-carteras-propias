/**
 * Copia texto al portapapeles. `navigator.clipboard` solo existe en contextos seguros (HTTPS
 * o localhost); si la app se abre por IP o dominio sin HTTPS, se usa el método clásico con un
 * textarea temporal. Devuelve si se pudo copiar.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Sin permiso: se intenta el método clásico.
    }
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

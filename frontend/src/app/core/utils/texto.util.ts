/** Primera letra de cada palabra en mayúscula — usado en los inputs "en vivo" (rol, novedad, módulo, etc.). */
export function capitalizarPalabras(valor: string): string {
  return valor.replace(/(^|\s)\p{L}/gu, (letra) => letra.toUpperCase());
}

/** Solo la primera letra en mayúscula (campos de descripción). */
export function capitalizarPrimeraLetra(valor: string): string {
  return valor.length ? valor.charAt(0).toUpperCase() + valor.slice(1) : valor;
}

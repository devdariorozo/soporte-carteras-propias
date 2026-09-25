/** Primera letra de cada palabra en mayúscula, resto igual (acentos incluidos). */
export function capitalizarPalabras(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (letra) => letra.toUpperCase());
}

/** Solo la primera letra del texto completo en mayúscula. */
export function capitalizarPrimeraLetra(texto: string): string {
  const limpio = texto.trim();
  return limpio.length ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : limpio;
}

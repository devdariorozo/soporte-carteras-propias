/**
 * Lectores tolerantes de los valores de `configuracion.objeto`: el CRUD guarda cada
 * valor con su formato (texto, número, sí/no), pero una fila editada a mano o
 * migrada puede traer un número o un sí/no como texto.
 */
export function leerNumero(valor: unknown): number | undefined {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : undefined;
  }
  if (typeof valor === 'string' && valor.trim() !== '') {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
  }
  return undefined;
}

/** `true`/`false` también escritos como texto (true, si, sí, 1 / false, no, 0). */
export function leerBooleano(valor: unknown): boolean | undefined {
  if (typeof valor === 'boolean') {
    return valor;
  }
  const texto = String(valor ?? '').trim().toLowerCase();
  if (['true', 'si', 'sí', '1'].includes(texto)) return true;
  if (['false', 'no', '0'].includes(texto)) return false;
  return undefined;
}

export function leerTexto(valor: unknown): string | undefined {
  if (valor === undefined || valor === null) {
    return undefined;
  }
  return String(valor);
}

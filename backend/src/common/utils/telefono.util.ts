/** Formato único del número de contacto: 10 dígitos agrupados 3-3-4 (ej. `321 256 5689`). */
export const TELEFONO_REGEX = /^\d{3} \d{3} \d{4}$/;

export const TELEFONO_MENSAJE = 'El número de contacto debe tener 10 dígitos (ej. 321 256 5689).';

/**
 * Normaliza a `XXX XXX XXXX` cualquier escritura de 10 dígitos (`3212565689`,
 * `321-256-5689`, `321 256 5689`). Si no son exactamente 10 dígitos se devuelve tal
 * cual, para que la validación lo rechace en vez de recortarlo en silencio.
 */
export function formatearTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 10 ? `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}` : valor;
}

/**
 * Copia solo las claves de `cambios` cuyo valor no es `undefined` (a diferencia de
 * `Object.assign`, que sobreescribe con `undefined` los campos opcionales que el
 * cliente no envió en un PATCH, perdiendo el valor ya guardado).
 */
export function asignarDefinidos<T extends object>(objetivo: T, cambios: Partial<T>): T {
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor !== undefined) {
      (objetivo as Record<string, unknown>)[clave] = valor;
    }
  }
  return objetivo;
}

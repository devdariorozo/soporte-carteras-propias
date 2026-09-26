/** Query string `?x=1&x=2` o `?x=1` -> siempre arreglo (para `@Transform` de los filtros). */
export const comoArregloDeTexto = ({ value }: { value: unknown }) =>
  value === undefined ? value : Array.isArray(value) ? value : [value];

export const comoArregloDeNumeros = ({ value }: { value: unknown }) => {
  if (value === undefined) return value;
  const arreglo = Array.isArray(value) ? value : [value];
  return arreglo.map(Number);
};

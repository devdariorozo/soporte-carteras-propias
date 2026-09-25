import { Pipe, PipeTransform } from '@angular/core';

export const TEXTO_VACIO = '---';

/**
 * Celdas de los listados: `null`, `undefined`, texto vacío o solo espacios se muestran
 * como `---` en vez de quedar en blanco. `0` y `false` sí son valores y se respetan.
 */
@Pipe({ name: 'vacio' })
export class VacioPipe implements PipeTransform {
  transform(valor: unknown): unknown {
    if (valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')) {
      return TEXTO_VACIO;
    }
    return valor;
  }
}

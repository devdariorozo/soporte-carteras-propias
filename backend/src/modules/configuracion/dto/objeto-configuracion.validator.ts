import { ValidationOptions, registerDecorator } from 'class-validator';

function esEscalar(valor: unknown): boolean {
  return typeof valor === 'string' || typeof valor === 'boolean' || (typeof valor === 'number' && Number.isFinite(valor));
}

/**
 * `objeto` plano: cada clave no vacía y cada valor texto, número, sí/no (boolean) o
 * lista de textos/números — los mismos formatos que ofrece el formulario de Configuración.
 */
export function EsObjetoConfiguracion(opciones?: ValidationOptions): PropertyDecorator {
  return (objetivo: object, propiedad: string | symbol) => {
    registerDecorator({
      name: 'esObjetoConfiguracion',
      target: objetivo.constructor,
      propertyName: propiedad as string,
      options: {
        message: 'El objeto solo admite claves con valores de texto, número, sí/no o lista.',
        ...opciones,
      },
      validator: {
        validate(valor: unknown): boolean {
          if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
            return false;
          }
          return Object.entries(valor).every(
            ([clave, dato]) =>
              clave.trim() !== '' &&
              (esEscalar(dato) || (Array.isArray(dato) && dato.every((item) => typeof item === 'string' || typeof item === 'number'))),
          );
        },
      },
    });
  };
}

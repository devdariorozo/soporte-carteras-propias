import { leerBooleano, leerNumero } from './objeto-valor.util.js';

type Conversion = 'texto' | 'numero' | 'booleano';

/** Se guardan tal cual (pueden tener espacios a propósito). */
const CLAVES_SECRETAS = new Set(['password', 'ssh_passphrase']);

/**
 * Tipo de cada clave conocida, por nombre de configuración. El formulario envía todo como
 * texto; aquí se convierte a lo que el sistema necesita.
 * Las claves y configuraciones no listadas se guardan tal cual llegan.
 * El orden de las claves es el que se muestra (MySQL reordena el JSON al guardarlo): en las
 * conexiones, como en DBeaver, primero la pestaña Main y luego la pestaña SSH.
 */
const ESQUEMAS: Record<string, Record<string, Conversion>> = {
  // MySQL sin `database` (la trae cada sentencia, `base.tabla`); PostgreSQL con `database`
  // (una conexión es de una sola base y las sentencias vienen como `esquema.tabla`).
  mysql: { host: 'texto', username: 'texto', password: 'texto', port: 'numero' },
  // `ssh_*` son opcionales: con `ssh_host` la conexión pasa por un túnel SSH (bastión).
  // `ssl` también es opcional: solo si la base exige conexión cifrada.
  postgres: {
    host: 'texto',
    database: 'texto',
    username: 'texto',
    password: 'texto',
    port: 'numero',
    ssl: 'booleano',
    ssh_host: 'texto',
    ssh_username: 'texto',
    ssh_passphrase: 'texto',
    ssh_port: 'numero',
  },
  rate_limit: { requests_por_minuto: 'numero' },
};

function convertir(valor: unknown, conversion: Conversion, clave: string): unknown {
  switch (conversion) {
    case 'numero':
      // Si no es un número válido se deja como llegó: la validación lo rechaza con un mensaje claro.
      return leerNumero(valor) ?? valor;
    case 'booleano':
      return leerBooleano(valor) ?? valor;
    default: {
      const texto = valor === undefined || valor === null ? '' : String(valor);
      return CLAVES_SECRETAS.has(clave) ? texto : texto.trim();
    }
  }
}

export function normalizarObjeto(nombre: string, objeto: Record<string, unknown>): Record<string, unknown> {
  const esquema = ESQUEMAS[nombre.trim().toLowerCase()];
  if (!esquema) {
    return objeto;
  }
  return Object.fromEntries(
    Object.entries(objeto).map(([clave, valor]) => [clave, esquema[clave] ? convertir(valor, esquema[clave], clave) : valor]),
  );
}

/** Claves conocidas en el orden de `ESQUEMAS` y después las demás, para mostrarlas siempre igual. */
export function ordenarObjeto(nombre: string, objeto: Record<string, unknown>): Record<string, unknown> {
  const orden = Object.keys(ESQUEMAS[nombre.trim().toLowerCase()] ?? {});
  const posicion = (clave: string) => (orden.includes(clave) ? orden.indexOf(clave) : orden.length);
  return Object.fromEntries(Object.entries(objeto ?? {}).sort(([a], [b]) => posicion(a) - posicion(b)));
}

import { BadRequestException } from '@nestjs/common';

/** Nombres de configuración que son conexiones a BD (los mismos valores del campo `motor` de Soporte). */
export const NOMBRES_CONEXION_BD = ['mysql', 'postgres'];

/**
 * Tipo que exige cada clave de una conexión (ya convertida por `normalizarObjeto`). `host`
 * debe ser texto: guardado como número (ej. una IP convertida a 172.178141) el driver lo
 * interpreta como otra dirección y la conexión se agota por tiempo sin decir por qué.
 */
type Tipo = 'texto' | 'puerto' | 'booleano';

const CLAVES: { clave: string; tipo: Tipo; obligatoria: boolean }[] = [
  { clave: 'host', tipo: 'texto', obligatoria: true },
  { clave: 'port', tipo: 'puerto', obligatoria: true },
  { clave: 'username', tipo: 'texto', obligatoria: true },
  { clave: 'password', tipo: 'texto', obligatoria: true },
];

/** Solo PostgreSQL: SSL y túnel SSH. Con `ssh_host`, `ssh_username` es obligatorio (la llave sale de SSH_KEY_PATH del .env). */
const CLAVES_POSTGRES: { clave: string; tipo: Tipo }[] = [
  { clave: 'ssl', tipo: 'booleano' },
  { clave: 'ssh_host', tipo: 'texto' },
  { clave: 'ssh_port', tipo: 'puerto' },
  { clave: 'ssh_username', tipo: 'texto' },
  { clave: 'ssh_passphrase', tipo: 'texto' },
];

/** Pueden ir vacías (contraseña o passphrase en blanco a propósito). */
const CLAVES_SECRETAS = new Set(['password', 'ssh_passphrase']);

function problemaDeTipo(clave: string, tipo: Tipo, valor: unknown): string | null {
  if (tipo === 'texto' && typeof valor !== 'string') {
    return `"${clave}" no es válido, vuelve a escribirlo`;
  }
  if (tipo === 'texto' && !CLAVES_SECRETAS.has(clave) && String(valor).trim() === '') {
    return `"${clave}" está vacío`;
  }
  if (tipo === 'puerto' && !(typeof valor === 'number' && Number.isInteger(valor) && valor > 0 && valor <= 65535)) {
    return `"${clave}" debe ser un número entero entre 1 y 65535`;
  }
  if (tipo === 'booleano' && typeof valor !== 'boolean') {
    return `"${clave}" debe ser true o false`;
  }
  return null;
}

/** Problemas del `objeto` de una conexión a BD (vacío si está bien). */
export function problemasConexionBd(nombre: string, objeto: Record<string, unknown>): string[] {
  const problemas: string[] = [];
  for (const { clave, tipo, obligatoria } of CLAVES) {
    const valor = objeto[clave];
    if (valor === undefined || valor === null) {
      if (obligatoria) problemas.push(`falta "${clave}"`);
      continue;
    }
    const problema = problemaDeTipo(clave, tipo, valor);
    if (problema) problemas.push(problema);
  }

  const clavesPostgres = CLAVES_POSTGRES.filter(({ clave }) => objeto[clave] !== undefined && objeto[clave] !== null);
  if (nombre !== 'postgres') {
    // Evita creer que MySQL usa túnel o SSL: el driver de MySQL no los aplica.
    if (clavesPostgres.length) {
      problemas.push(`${clavesPostgres.map(({ clave }) => `"${clave}"`).join(', ')} solo aplican a "postgres"`);
    }
    return problemas;
  }
  // Una conexión PostgreSQL es de una sola base: la sentencia trae `esquema.tabla`.
  if (objeto.database === undefined || objeto.database === null) {
    problemas.push('falta "database"');
  } else {
    const problema = problemaDeTipo('database', 'texto', objeto.database);
    if (problema) problemas.push(problema);
  }
  for (const { clave, tipo } of clavesPostgres) {
    const problema = problemaDeTipo(clave, tipo, objeto[clave]);
    if (problema) problemas.push(problema);
  }
  if (objeto.ssh_host !== undefined && objeto.ssh_host !== null) {
    for (const clave of ['ssh_username']) {
      if (objeto[clave] === undefined || objeto[clave] === null) problemas.push(`falta "${clave}" (requerido con "ssh_host")`);
    }
  }
  return problemas;
}

/** Al crear o editar una configuración `mysql`/`postgres`, rechaza el objeto si está mal tipado. */
export function exigirConexionBdValida(nombre: string, objeto: Record<string, unknown>, titulo: string): void {
  if (!NOMBRES_CONEXION_BD.includes(nombre)) {
    return;
  }
  const problemas = problemasConexionBd(nombre, objeto);
  if (problemas.length) {
    throw new BadRequestException({
      title: titulo,
      message: `La conexión "${nombre}" no es válida: ${problemas.join('; ')}.`,
    });
  }
}

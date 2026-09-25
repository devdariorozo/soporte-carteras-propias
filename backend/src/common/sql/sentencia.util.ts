/**
 * Regla rígida de Soporte: solo se ejecutan sentencias UPDATE con cláusula WHERE o INSERT
 * limpios (`INSERT INTO tabla (columnas) VALUES (...)`). Una solicitud puede traer varias
 * (ej. un script de DBeaver con comentarios entre ellas): se separan por `;` y se valida
 * cada una. Se valida al crear, al editar y otra vez justo antes de ejecutar.
 *
 * Criterio:
 *  - Se separa por `;` fuera de textos ('...', "...", `...`) y comentarios (--, #, /* *\/).
 *  - Cada sentencia debe empezar por UPDATE o INSERT (se ignoran los comentarios iniciales).
 *  - Una solicitud es solo de UPDATE o solo de INSERT: si se mezclan, se rechaza completa.
 *  - UPDATE: debe tener WHERE en su nivel principal (no en un texto, comentario ni
 *    subconsulta): nunca un UPDATE sobre toda la tabla.
 *  - INSERT: solo `INSERT INTO tabla (columnas) VALUES (...)[, (...)]` con valores escritos. Se
 *    rechaza lo que inserta filas no visibles (SELECT), modifica registros existentes
 *    (ON DUPLICATE KEY UPDATE, ON CONFLICT, REPLACE), oculta errores (IGNORE) o devuelve
 *    datos (RETURNING).
 *  - Se rechazan los comentarios ejecutables de MySQL (`/*! ... *\/`), que ejecutan su contenido.
 *  - Se rechaza la sentencia que trae rasgos del otro motor (ver `esDeOtroMotor`): `base.tabla`
 *    y `esquema.tabla` se escriben igual, así que sin esto se conectaría al motor equivocado.
 *  - MySQL: la base la trae cada sentencia en la tabla (`base.tabla`) y de ahí se toma para conectarse.
 *  - PostgreSQL: la base sale de Configuración (`database`), porque una conexión es de una sola base
 *    y DBeaver genera los scripts como `esquema.tabla`. También se acepta `base.esquema.tabla`;
 *    esa base debe coincidir con la configurada (se comprueba al ejecutar).
 *  - Cada sentencia se ejecuta en su propia llamada al motor, con múltiples sentencias
 *    deshabilitadas: si esta separación y la del motor no coincidieran, el motor da error
 *    de sintaxis en vez de ejecutar algo no validado.
 */
export type MotorSentencia = 'mysql' | 'postgres';

export interface ValidacionSentencia {
  valida: boolean;
  /** Sentencias listas para ejecutar, en orden (solo si `valida`). */
  sentencias: string[];
  /**
   * Base de datos de cada sentencia, extraída de su tabla (solo si se indicó el motor). En
   * PostgreSQL es '' cuando la tabla viene como `esquema.tabla` (la base sale de Configuración).
   */
  bases: string[];
  mensaje: string | null;
}

/** Forma exigida por motor para el nombre de la tabla de la sentencia. */
const FORMA_TABLA: Record<MotorSentencia, { falta: string; ejemplo: string }> = {
  mysql: { falta: 'la base de datos', ejemplo: 'base.tabla (ej. miosv2_falabella_2024.promises)' },
  postgres: { falta: 'el esquema', ejemplo: 'esquema.tabla (ej. public.promises)' },
};

const IDENTIFICADOR = '(?:`[^`]+`|"[^"]+"|[A-Za-z0-9_$]+)';
const TABLA_DE_LA_SENTENCIA = new RegExp(
  `^(?:UPDATE\\s+(?:(?:LOW_PRIORITY|IGNORE|ONLY)\\s+)*|INSERT\\s+INTO\\s+)(${IDENTIFICADOR}(?:\\s*\\.\\s*${IDENTIFICADOR})*)`,
  'i',
);

function quitarComentariosIniciales(sql: string): string {
  let resto = sql.trimStart();
  for (;;) {
    if (resto.startsWith('--') || resto.startsWith('#')) {
      const fin = resto.indexOf('\n');
      resto = fin === -1 ? '' : resto.slice(fin + 1).trimStart();
    } else if (resto.startsWith('/*')) {
      const fin = resto.indexOf('*/');
      resto = fin === -1 ? '' : resto.slice(fin + 2).trimStart();
    } else {
      return resto;
    }
  }
}

/** Nombre de la tabla de la sentencia tal como se escribió (con comillas si las trae), o null. */
function nombreTabla(sentencia: string): string | null {
  return quitarComentariosIniciales(sentencia).match(TABLA_DE_LA_SENTENCIA)?.[1] ?? null;
}

/** Partes del nombre de la tabla de la sentencia, sin comillas (ej. ["miosv2_falabella_2024", "promises"]). */
function partesTabla(sentencia: string): string[] {
  const nombre = nombreTabla(sentencia);
  if (!nombre) {
    return [];
  }
  return (nombre.match(new RegExp(IDENTIFICADOR, 'g')) ?? []).map((parte) => parte.replace(/^[`"]|[`"]$/g, ''));
}

/**
 * Base de datos que trae la sentencia, o null si la tabla no viene en la forma exigida.
 * MySQL: `base.tabla`. PostgreSQL: `esquema.tabla` ('' = la base de Configuración) o `base.esquema.tabla`.
 */
export function extraerBaseDeDatos(sentencia: string, motor: MotorSentencia): string | null {
  const partes = partesTabla(sentencia);
  if (motor === 'mysql') {
    return partes.length === 2 ? partes[0] : null;
  }
  if (partes.length === 2) {
    return '';
  }
  return partes.length === 3 ? partes[0] : null;
}

const TITULO_REGLA = 'Solo se permiten sentencias UPDATE con WHERE o INSERT INTO ... VALUES.';

/** Separa por `;` fuera de textos y comentarios; descarta los fragmentos que solo tienen comentarios. */
export function separarSentencias(sql: string): string[] {
  const sentencias: string[] = [];
  let actual = '';
  let i = 0;
  while (i < sql.length) {
    const caracter = sql[i];
    const siguiente = sql[i + 1];
    if (caracter === "'" || caracter === '"' || caracter === '`') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\' && caracter !== '`') {
          j += 2;
          continue;
        }
        if (sql[j] === caracter) {
          if (sql[j + 1] === caracter) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      actual += sql.slice(i, j + 1);
      i = j + 1;
    } else if ((caracter === '-' && siguiente === '-') || caracter === '#') {
      const fin = sql.indexOf('\n', i);
      const j = fin === -1 ? sql.length : fin;
      actual += sql.slice(i, j);
      i = j;
    } else if (caracter === '/' && siguiente === '*') {
      const fin = sql.indexOf('*/', i + 2);
      const j = fin === -1 ? sql.length : fin + 2;
      actual += sql.slice(i, j);
      i = j;
    } else if (caracter === ';') {
      sentencias.push(actual);
      actual = '';
      i++;
    } else {
      actual += caracter;
      i++;
    }
  }
  sentencias.push(actual);
  return sentencias.map((sentencia) => sentencia.trim()).filter((sentencia) => soloCodigo(sentencia).trim() !== '');
}

/** Quita textos ('...', "...", `...`) y comentarios para buscar palabras clave solo en el SQL real. */
function soloCodigo(sql: string): string {
  return sql
    .replace(/'(?:[^'\\]|\\.|'')*'/g, ' ')
    .replace(/"(?:[^"\\]|\\.|"")*"/g, ' ')
    .replace(/`(?:[^`]|``)*`/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(--|#)[^\n]*/g, ' ');
}

/** El código sin lo que va dentro de paréntesis (subconsultas, funciones). */
function nivelPrincipal(codigo: string): string {
  let nivel = 0;
  let principal = '';
  for (const caracter of codigo) {
    if (caracter === '(') {
      principal += nivel === 0 ? '(' : ' ';
      nivel++;
    } else if (caracter === ')') {
      nivel = Math.max(0, nivel - 1);
      principal += nivel === 0 ? ')' : ' ';
    } else {
      principal += nivel === 0 ? caracter : ' ';
    }
  }
  return principal;
}

/** El WHERE debe estar en el nivel principal: uno dentro de una subconsulta `( ... )` no limita el UPDATE. */
function tieneWherePrincipal(codigo: string): boolean {
  return /\bWHERE\b\s*\S/i.test(nivelPrincipal(codigo));
}

const NOMBRE_MOTOR: Record<MotorSentencia, string> = { mysql: 'MySQL', postgres: 'PostgreSQL' };

/** Convención de nombres: bases de MySQL (Carteras Propias V1) y esquemas de PostgreSQL. */
const PREFIJO_NOMBRE: Record<MotorSentencia, RegExp> = { mysql: /^miosv2_/i, postgres: /^tenant_/i };

/**
 * true si la sentencia trae un rasgo que solo existe en el otro motor: la convención de nombres
 * (`miosv2_*` / `tenant_*`) o sintaxis que el motor elegido no acepta.
 */
function esDeOtroMotor(sentencia: string, motor: MotorSentencia): boolean {
  const nombre = nombreTabla(sentencia) ?? '';
  const partes = partesTabla(sentencia);
  const otro: MotorSentencia = motor === 'mysql' ? 'postgres' : 'mysql';
  if (partes[0] && PREFIJO_NOMBRE[otro].test(partes[0])) {
    return true;
  }
  const codigo = soloCodigo(sentencia);
  const principal = nivelPrincipal(codigo);
  if (motor === 'postgres') {
    return (
      nombre.includes('`') ||
      /^\s*UPDATE\s+(?:LOW_PRIORITY|IGNORE)\b/i.test(codigo) ||
      /\b(?:LIMIT|ORDER\s+BY)\b/i.test(principal)
    );
  }
  return (
    partes.length === 3 ||
    nombre.includes('"') ||
    codigo.includes('::') ||
    /^\s*UPDATE\s+ONLY\b/i.test(codigo) ||
    /\b(?:RETURNING|ILIKE)\b/i.test(principal)
  );
}

/** Primera palabra del código (ej. 'UPDATE', 'INSERT'), en mayúsculas, o null. */
function tipoSentencia(sentencia: string): string | null {
  return soloCodigo(sentencia).trimStart().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? null;
}

/**
 * Forma exacta del INSERT limpio sobre el nivel principal (lo de dentro de los paréntesis ya
 * viene en blanco): `INSERT INTO tabla ( ) VALUES ( ) [, ( )]...`.
 */
const FORMA_INSERT = /^\s*INSERT\s+INTO\s+[^()]+\(\s*\)\s*VALUES\s*\(\s*\)(?:\s*,\s*\(\s*\))*\s*$/i;

/** Motivo por el que un INSERT no es limpio, o null si lo es. */
function motivoRechazoInsert(codigo: string): string | null {
  const principal = nivelPrincipal(codigo);
  if (!/^\s*INSERT\s+INTO\b/i.test(principal)) {
    return /^\s*INSERT\s+(?:LOW_PRIORITY\s+|DELAYED\s+|HIGH_PRIORITY\s+)*IGNORE\b/i.test(principal)
      ? 'usa INSERT IGNORE, que oculta los errores; retira IGNORE.'
      : 'debe escribirse como INSERT INTO tabla (columnas) VALUES (...).';
  }
  if (/\bSELECT\b/i.test(codigo)) {
    return 'trae un SELECT; solo se permiten valores escritos en VALUES.';
  }
  if (/\bON\s+(?:DUPLICATE|CONFLICT)\b/i.test(principal)) {
    return 'modifica registros existentes (ON DUPLICATE KEY UPDATE / ON CONFLICT); retira esa cláusula.';
  }
  if (/\bRETURNING\b/i.test(principal)) {
    return 'usa RETURNING; retira esa cláusula.';
  }
  if (!/^\s*INSERT\s+INTO\s+[^()]+\(\s*\)\s*VALUES\b/i.test(principal)) {
    return 'debe indicar la lista de columnas: INSERT INTO tabla (columnas) VALUES (...).';
  }
  if (!FORMA_INSERT.test(principal)) {
    return 'debe tener solo la forma INSERT INTO tabla (columnas) VALUES (...).';
  }
  return null;
}

/** Motivo por el que una sentencia no se permite, o null si es un UPDATE con WHERE o un INSERT limpio. */
function motivoRechazo(sentencia: string): string | null {
  const codigo = soloCodigo(sentencia);
  const tipo = tipoSentencia(sentencia);
  if (tipo !== 'UPDATE' && tipo !== 'INSERT') {
    return tipo ? `es un ${tipo}; ajústala a un UPDATE o a un INSERT.` : 'no se reconoce el tipo de sentencia.';
  }
  if (/\/\*[!+]/.test(sentencia)) {
    return 'contiene comentarios ejecutables (/*! */); retíralos.';
  }
  if (tipo === 'INSERT') {
    return motivoRechazoInsert(codigo);
  }
  if (!tieneWherePrincipal(codigo)) {
    return 'no tiene cláusula WHERE para limitar los registros a actualizar.';
  }
  return null;
}

/**
 * Con `motor`, además exige la forma de la tabla (ver `extraerBaseDeDatos`) y devuelve la base
 * de cada sentencia en `bases`. En PostgreSQL las que la indiquen deben ser la misma (una
 * conexión es de una sola base); en MySQL pueden ser distintas bases del mismo servidor.
 */
export function validarSentencia(sql: string, motor?: MotorSentencia): ValidacionSentencia {
  const rechazo = (mensaje: string): ValidacionSentencia => ({ valida: false, sentencias: [], bases: [], mensaje });
  const sentencias = separarSentencias(sql ?? '');
  if (!sentencias.length) {
    return rechazo(`${TITULO_REGLA}\nNo se encontró ninguna sentencia para ejecutar.`);
  }
  const bases: string[] = [];
  for (const [indice, sentencia] of sentencias.entries()) {
    const cual = sentencias.length > 1 ? `La sentencia ${indice + 1} de ${sentencias.length}` : 'La sentencia';
    const motivo = motivoRechazo(sentencia);
    if (motivo) {
      return rechazo(`${TITULO_REGLA}\n${cual} ${motivo}`);
    }
    const tipo = tipoSentencia(sentencia);
    const primerTipo = tipoSentencia(sentencias[0]);
    if (tipo !== primerTipo) {
      return rechazo(
        `No se pueden mezclar UPDATE e INSERT en una misma solicitud.\n${cual} es un ${tipo}, pero la solicitud empieza con ${primerTipo}. Envía solo UPDATE o solo INSERT.`,
      );
    }
    if (motor) {
      if (esDeOtroMotor(sentencia, motor)) {
        const otro = NOMBRE_MOTOR[motor === 'mysql' ? 'postgres' : 'mysql'];
        return rechazo(`${cual} parece de ${otro}, pero el motor elegido es ${NOMBRE_MOTOR[motor]}.\nElige el motor ${otro} o ajusta la sentencia.`);
      }
      const base = extraerBaseDeDatos(sentencia, motor);
      if (base === null) {
        const { falta, ejemplo } = FORMA_TABLA[motor];
        return rechazo(`La sentencia debe indicar ${falta}.\n${cual} debe escribir la tabla como ${ejemplo}.`);
      }
      bases.push(base);
    }
  }
  const basesIndicadas = new Set(bases.filter(Boolean));
  if (motor === 'postgres' && basesIndicadas.size > 1) {
    return rechazo(
      `En PostgreSQL todas las sentencias deben ser de la misma base de datos.\nSe encontraron: ${[...basesIndicadas].join(', ')}.`,
    );
  }
  return { valida: true, sentencias, bases, mensaje: null };
}

import { ErrorEnSentencia } from '../../common/raw-db/error-sentencia.js';
import { MotorSoporte } from './soporte.entity.js';

const REVISAR_CONFIGURACION = 'Repórtalo al Super Administrador para que revise la conexión en Configuración.';

/**
 * Errores de acceso o de conexión que el driver describe con datos de la conexión (host,
 * usuario, base): se reemplazan por un mensaje propio, sin repetir el texto del driver.
 * PostgreSQL: SQLSTATE. MySQL: `code` de mysql2.
 */
const MENSAJES_POR_CODIGO: Record<MotorSoporte, Record<string, string>> = {
  [MotorSoporte.POSTGRES]: {
    // `28000` incluye "no pg_hba.conf entry": el servidor no acepta este origen o exige cifrado.
    '28000': `El servidor PostgreSQL rechazó la conexión desde este servidor (puede exigir conexión cifrada).\n${REVISAR_CONFIGURACION}`,
    '28P01': `El servidor PostgreSQL rechazó las credenciales de la conexión.\n${REVISAR_CONFIGURACION}`,
    '3D000': `La base de datos de la conexión no existe en el servidor PostgreSQL.\n${REVISAR_CONFIGURACION}`,
    '42501': 'La conexión configurada no tiene permiso para modificar esa tabla; no se aplicó ningún cambio.',
    '53300': 'El servidor PostgreSQL no admite más conexiones en este momento. Intenta de nuevo en unos minutos.',
  },
  [MotorSoporte.MYSQL]: {
    ER_ACCESS_DENIED_ERROR: `El servidor MySQL rechazó las credenciales de la conexión.\n${REVISAR_CONFIGURACION}`,
    ER_HOST_NOT_PRIVILEGED: `El servidor MySQL no acepta conexiones desde este servidor.\n${REVISAR_CONFIGURACION}`,
    ER_DBACCESS_DENIED_ERROR: 'La conexión configurada no tiene acceso a la base de datos de la sentencia; no se aplicó ningún cambio.',
    ER_TABLEACCESS_DENIED_ERROR: 'La conexión configurada no tiene permiso para modificar esa tabla; no se aplicó ningún cambio.',
    ER_COLUMNACCESS_DENIED_ERROR: 'La conexión configurada no tiene permiso para modificar esa columna; no se aplicó ningún cambio.',
    ER_BAD_DB_ERROR: 'La base de datos de la sentencia no existe en el servidor MySQL; no se aplicó ningún cambio.',
  },
};

/** Mensaje propio para errores de acceso/conexión, o null si es un error de la sentencia. */
export function mensajeErrorDeAcceso(motor: MotorSoporte, error: unknown): string | null {
  const original = error instanceof ErrorEnSentencia ? error.causa : error;
  const codigo = (original as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? (MENSAJES_POR_CODIGO[motor][codigo] ?? null) : null;
}

/** Claves de la conexión cuyo valor nunca debe aparecer en un mensaje para el usuario. */
const CLAVES_SENSIBLES = ['host', 'username', 'password', 'database', 'ssh_host', 'ssh_username', 'ssh_passphrase'];

const OCULTO = '***';

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Última barrera antes de mostrar o guardar un mensaje de error: quita los valores de la
 * conexión (y los hosts ya resueltos) y los patrones con que los drivers citan usuario,
 * host, base o direcciones IP.
 */
export function ocultarDatosConexion(mensaje: string, objeto: Record<string, unknown> | null, extras: string[] = []): string {
  const valores = [...CLAVES_SENSIBLES.map((clave) => objeto?.[clave]), ...extras]
    .filter((valor): valor is string => typeof valor === 'string' && valor.trim().length >= 3)
    .map((valor) => valor.trim())
    .sort((a, b) => b.length - a.length);

  let limpio = mensaje;
  for (const valor of valores) {
    limpio = limpio.replace(new RegExp(escaparRegex(valor), 'gi'), OCULTO);
  }
  return limpio
    .replace(/'[^']*'@'[^']*'/g, OCULTO)
    .replace(/\b(user|role|host|database|usuario|base)\s+"[^"]*"/gi, `$1 "${OCULTO}"`)
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, OCULTO);
}

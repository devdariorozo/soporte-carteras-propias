import { Injectable, Logger } from '@nestjs/common';
import { isIP } from 'node:net';
import pg from 'pg';
import { ErrorEnSentencia } from './error-sentencia.js';
import { TunelSsh, TunelSshConfig, abrirTunelSsh } from './tunel-ssh.js';

export interface RawPostgresConfig {
  host: string;
  port: number;
  usuario: string;
  password: string;
  database?: string;
  /** Cifra la conexión con la base (AWS RDS suele exigirlo). No verifica el certificado del servidor. */
  ssl?: boolean;
  /** Si viene, la conexión pasa por un túnel SSH a través de ese bastión. */
  ssh?: TunelSshConfig;
}

const CONNECT_TIMEOUT_MS = 10_000;

/**
 * Conexión cruda (sin TypeORM) contra un servidor PostgreSQL arbitrario — contraparte
 * de `RawMysqlService` para los registros de `soporte` con `motor = 'postgres'`.
 * Una conexión (y, si aplica, un túnel SSH) por ejecución, siempre cerrados al terminar.
 */
@Injectable()
export class RawPostgresService {
  private readonly logger = new Logger(RawPostgresService.name);

  /**
   * Ejecuta las sentencias en orden dentro de una transacción (todas o ninguna). Cada una va
   * por el protocolo extendido (`queryMode: 'extended'`), que no admite varias sentencias en
   * una misma llamada. Una conexión por ejecución, siempre cerrada.
   */
  async executeEnTransaccion(config: RawPostgresConfig, sentencias: string[]): Promise<void> {
    // El túnel se abre antes que la conexión: si falla, el error es del túnel (no cuenta como sentencia fallida).
    const tunel: TunelSsh | null = config.ssh
      ? await abrirTunelSsh(config.ssh, config.host, config.port, CONNECT_TIMEOUT_MS)
      : null;
    const client = new pg.Client({
      host: tunel ? '127.0.0.1' : config.host,
      port: tunel ? tunel.puertoLocal : config.port,
      user: config.usuario,
      password: config.password,
      database: config.database,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      // Por el túnel el host es 127.0.0.1: `servername` conserva el nombre real para el handshake TLS.
      ssl: config.ssl ? { rejectUnauthorized: false, servername: isIP(config.host) ? undefined : config.host } : undefined,
    });
    let numero = 0;
    let enTransaccion = false;
    try {
      await client.connect();
      await client.query('BEGIN');
      enTransaccion = true;
      for (const sentencia of sentencias) {
        numero++;
        // `queryMode` existe en pg (lib/query.js) aunque @types/pg no lo declara.
        await client.query({ text: sentencia, queryMode: 'extended' } as pg.QueryConfig);
      }
      await client.query('COMMIT');
    } catch (error) {
      this.logger.error('Error ejecutando sentencia contra el servidor PostgreSQL', error as Error);
      if (enTransaccion) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      throw new ErrorEnSentencia(error, Math.max(numero, 1), sentencias.length);
    } finally {
      await client.end().catch(() => undefined);
      await tunel?.cerrar();
    }
  }
}

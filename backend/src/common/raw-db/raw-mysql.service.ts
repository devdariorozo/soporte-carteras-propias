import { Injectable, Logger } from '@nestjs/common';
import mysql from 'mysql2/promise';
import { ErrorEnSentencia } from './error-sentencia.js';

export interface RawMysqlConfig {
  host: string;
  port: number;
  usuario: string;
  password: string;
  database?: string;
}

/**
 * Conexión cruda (sin TypeORM) contra un servidor MySQL arbitrario, usada para
 * ejecutar sentencias registradas en `soporte` contra el servidor de las carteras
 * propias (ver planing/07-infraestructura.md y el skill /conexion-dinamica-bd, que
 * completa la resolución de la config activa y las transiciones de estado en la Fase 4).
 */
@Injectable()
export class RawMysqlService {
  private readonly logger = new Logger(RawMysqlService.name);

  /**
   * Ejecuta las sentencias en orden, una por llamada (`multipleStatements: false`), dentro de
   * una transacción: o se aplican todas o ninguna. Una conexión por ejecución, siempre cerrada.
   */
  async executeEnTransaccion(config: RawMysqlConfig, sentencias: string[]): Promise<void> {
    let connection: mysql.Connection | undefined;
    let numero = 0;
    try {
      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.usuario,
        password: config.password,
        database: config.database,
        multipleStatements: false,
      });
      await connection.beginTransaction();
      for (const sentencia of sentencias) {
        numero++;
        await connection.query(sentencia);
      }
      await connection.commit();
    } catch (error) {
      this.logger.error('Error ejecutando sentencia contra el servidor de carteras', error as Error);
      await connection?.rollback().catch(() => undefined);
      throw new ErrorEnSentencia(error, Math.max(numero, 1), sentencias.length);
    } finally {
      if (connection) {
        await connection.end().catch(() => undefined);
      }
    }
  }
}

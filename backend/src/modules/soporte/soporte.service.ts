import { HttpException, HttpStatus, Injectable, NotFoundException, OnModuleDestroy, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { Repository } from 'typeorm';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { asignarDefinidos } from '../../common/utils/asignar-definidos.util.js';
import { capitalizarPalabras } from '../../common/utils/texto.util.js';
import { validarSentencia } from '../../common/sql/sentencia.util.js';
import { RawMysqlService } from '../../common/raw-db/raw-mysql.service.js';
import { RawPostgresService } from '../../common/raw-db/raw-postgres.service.js';
import { ErrorTunelSsh } from '../../common/raw-db/tunel-ssh.js';
import { ErrorEnSentencia } from '../../common/raw-db/error-sentencia.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { leerNumero, leerTexto } from '../configuracion/objeto-valor.util.js';
import { problemasConexionBd } from '../configuracion/conexion-bd.util.js';
import { normalizarObjeto } from '../configuracion/normalizar-objeto.util.js';
import { EstadoSoporte, MotorSoporte, Soporte } from './soporte.entity.js';
import { CrearSoporteDto } from './dto/crear-soporte.dto.js';
import { ActualizarSoporteDto } from './dto/actualizar-soporte.dto.js';
import { COLA_EJECUCION_SENTENCIAS, EjecucionSentenciaJob } from './ejecucion.constants.js';
import { mensajeErrorDeAcceso, ocultarDatosConexion } from './error-ejecucion.util.js';

const TITULO = 'Soporte';
const TIMEOUT_EJECUCION_MS = 30_000;
const RATE_LIMIT_VENTANA_SEGUNDOS = 60;
const RATE_LIMIT_CLAVE_REDIS = 'rate_limit:ejecutar-soporte';
const LIMITE_SUGERENCIAS_CLIENTE = 10;

/** Errores de red al conectar (no de la sentencia): servidor caído o sin VPN corporativa. */
const CODIGOS_SIN_CONEXION = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST',
]);

class SentenciaNoPermitidaError extends Error {}

/** Hosts que significan "esta máquina"; en Docker se reemplazan por HOST_LOCAL_ALIAS (la máquina anfitriona). */
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Sin Docker (npm start) `localhost` ya es la máquina: HOST_LOCAL_ALIAS no está definido y
 * el host se usa tal cual. Con Docker, docker-compose.yml define HOST_LOCAL_ALIAS.
 */
function resolverHost(host: string): string {
  const alias = process.env.HOST_LOCAL_ALIAS?.trim();
  return alias && HOSTS_LOCALES.has(host.trim().toLowerCase()) ? alias : host.trim();
}

/** pg no trae `code` cuando se agota su connectionTimeoutMillis: se reconoce por el mensaje. */
const MENSAJES_TIMEOUT_POSTGRES = ['timeout expired', 'Connection terminated due to connection timeout'];

const MENSAJE_SIN_CONEXION_POSTGRES =
  'Sin conexión con la base PostgreSQL.\n' +
  'El servidor no respondió. Repórtalo al Super Administrador para que revise la conexión (y el túnel por bastión, si aplica) en Configuración.';

const MENSAJE_SIN_CONEXION_MYSQL =
  'Sin conexión con Carteras Propias V1.\n' +
  'Conecta la VPN corporativa e intenta de nuevo. Si ya está conectada, el servidor puede estar caído: repórtalo por el grupo Team Devs Portfolios - Dario.';


@Injectable()
export class SoporteService implements OnModuleDestroy {
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectRepository(Soporte) private readonly soportes: Repository<Soporte>,
    @InjectQueue(COLA_EJECUCION_SENTENCIAS) private readonly cola: Queue<EjecucionSentenciaJob>,
    private readonly rawMysqlService: RawMysqlService,
    private readonly rawPostgresService: RawPostgresService,
    private readonly redisService: RedisService,
    private readonly configuracionService: ConfiguracionService,
  ) {
    this.queueEvents = new QueueEvents(COLA_EJECUCION_SENTENCIAS, {
      connection: { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) },
    });
  }

  async create(dto: CrearSoporteDto, idUsuario: number) {
    this.exigirSentenciaPermitida(dto.sentencia, dto.motor);
    const soporte = await this.soportes.save(
      this.soportes.create({
        cliente: capitalizarPalabras(dto.cliente),
        mensajeWhatsapp: dto.mensajeWhatsapp,
        motor: dto.motor,
        sentencia: dto.sentencia,
        idNovedad: dto.idNovedad,
        estadoSoporte: EstadoSoporte.CREADO,
        idUsuario,
        descripcion: 'Creado.',
        estadoRegistro: 1,
      }),
    );
    return { message: 'Registro de soporte creado correctamente.', data: soporte };
  }

  async findAll(query: PaginacionQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.soportes.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
    });
    return { data, pagination: buildPaginationBlock(total, page, limit) };
  }

  /**
   * Clientes distintos ya registrados que contienen `texto`, para unificar la escritura
   * (evita Leidy / Leydi / Lady). La collation de la BD no distingue mayúsculas.
   */
  async motores() {
    return { data: await this.configuracionService.opcionesMotor() };
  }

  async clientes(texto = '') {
    const patron = `%${texto.trim().replace(/[\\%_]/g, '\\$&')}%`;
    const filas = await this.soportes
      .createQueryBuilder('soporte')
      .select('DISTINCT soporte.cliente', 'cliente')
      .where('soporte.estadoRegistro = 1')
      .andWhere('soporte.cliente LIKE :patron', { patron })
      .orderBy('soporte.cliente', 'ASC')
      .limit(LIMITE_SUGERENCIAS_CLIENTE)
      .getRawMany<{ cliente: string }>();
    return { data: filas.map((fila) => fila.cliente) };
  }

  async findOne(id: number) {
    const soporte = await this.obtenerOFallar(id);
    return { data: soporte };
  }

  async update(id: number, dto: ActualizarSoporteDto, idUsuario: number) {
    const soporte = await this.obtenerOFallar(id);
    if (dto.sentencia !== undefined || dto.motor !== undefined) {
      this.exigirSentenciaPermitida(dto.sentencia ?? soporte.sentencia, dto.motor ?? soporte.motor);
    }
    asignarDefinidos(soporte, dto);
    if (dto.cliente !== undefined) {
      soporte.cliente = capitalizarPalabras(dto.cliente);
    }
    soporte.idUsuario = idUsuario;
    await this.soportes.save(soporte);
    return { message: 'Registro de soporte actualizado correctamente.', data: soporte };
  }

  async remove(id: number, idUsuario: number) {
    await this.obtenerOFallar(id);
    await this.soportes.update(id, { estadoRegistro: 0, idUsuario, descripcion: 'Eliminado.' });
    await this.soportes.softDelete(id);
    return { message: 'Registro de soporte eliminado correctamente.' };
  }

  /**
   * Punto de entrada HTTP: aplica el rate limit configurable (`configuracion.nombre =
   * 'rate_limit'`), encola la ejecución real en BullMQ (desacopla la recepción de la
   * solicitud de la ejecución, ver planing/07-infraestructura.md) y espera su
   * resultado antes de responder — el contrato HTTP no cambia frente a la versión
   * síncrona anterior (Fase 4), solo la ejecución interna pasa por la cola.
   */
  async ejecutar(id: number, idUsuario: number) {
    await this.obtenerOFallar(id);
    await this.verificarRateLimit();

    const job = await this.cola.add('ejecutar', { soporteId: id, idUsuario });
    await job.waitUntilFinished(this.queueEvents, TIMEOUT_EJECUCION_MS);

    const soporte = await this.obtenerOFallar(id);
    return { message: 'Ejecución procesada.', data: soporte };
  }

  /**
   * Lógica real de ejecución (llamada por `ejecucion.processor.ts`, nunca
   * directamente desde el controlador): Creado -> En proceso -> Completado | Error,
   * siempre persistido, sin dejar conexiones abiertas en ninguna rama (ver skill
   * /conexion-dinamica-bd).
   */
  async procesarEjecucion(id: number, idUsuario: number): Promise<void> {
    const soporte = await this.obtenerOFallar(id);

    soporte.estadoSoporte = EstadoSoporte.EN_PROCESO;
    soporte.idUsuario = idUsuario;
    await this.soportes.save(soporte);

    let objeto: Record<string, unknown> | null = null;
    try {
      objeto = await this.configuracionService.obtenerActivaPorNombre(soporte.motor);
      if (!objeto) {
        throw new Error(`No hay una conexión activa configurada (configuracion.nombre = "${soporte.motor}").`);
      }
      // Última barrera: aunque el registro se haya guardado por otra vía, nunca se ejecuta algo que no sea un UPDATE con WHERE o un INSERT limpio.
      const validacion = validarSentencia(soporte.sentencia, soporte.motor);
      if (!validacion.valida) {
        throw new SentenciaNoPermitidaError(validacion.mensaje as string);
      }
      await this.ejecutarSentencias(soporte.motor, objeto, validacion.sentencias, validacion.bases);

      soporte.estadoSoporte = EstadoSoporte.COMPLETADO;
      soporte.descripcion = `✅ ${soporte.cliente}, la novedad fue resuelta correctamente; por favor revise nuevamente.🤝`;
    } catch (error) {
      soporte.estadoSoporte = EstadoSoporte.ERROR;
      // El detalle completo ya quedó en el log del servidor; al usuario nunca le llegan datos de la conexión.
      soporte.descripcion = ocultarDatosConexion(this.mensajeError(soporte.motor, error), objeto, [
        resolverHost(leerTexto(objeto?.host) ?? ''),
        resolverHost(leerTexto(objeto?.ssh_host) ?? ''),
      ]);
    }

    await this.soportes.save(soporte);
  }

  /**
   * Contador global en Redis por ventana de 1 minuto (una sola conexión compartida,
   * no hay límite por usuario) — sin fila activa `configuracion.nombre = 'rate_limit'`
   * (objeto `{ requests_por_minuto }`), no aplica ningún límite.
   */
  private async verificarRateLimit(): Promise<void> {
    const objeto = await this.configuracionService.obtenerActivaPorNombre('rate_limit');
    const limite = leerNumero(objeto?.requests_por_minuto);
    if (!limite) {
      return;
    }
    const ventana = Math.floor(Date.now() / (RATE_LIMIT_VENTANA_SEGUNDOS * 1000));
    const conteo = await this.redisService.incrementarContador(
      `${RATE_LIMIT_CLAVE_REDIS}:${ventana}`,
      RATE_LIMIT_VENTANA_SEGUNDOS,
    );
    if (conteo > limite) {
      throw new HttpException(
        { title: TITULO, message: 'Se alcanzó el límite de ejecuciones por minuto, intenta de nuevo en unos segundos.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * `objeto` de la conexión (`configuracion.nombre = motor`): `{ host, port, username,
   * password }`; en PostgreSQL además `database` (obligatoria), y `ssl` y `ssh_*` (túnel
   * por bastión), opcionales. Base de datos: en MySQL la trae la sentencia (`base.tabla`); en
   * PostgreSQL sale de `database` (si la sentencia trae `base.esquema.tabla`, debe coincidir).
   * Todas las sentencias van en una misma transacción: o se aplican todas o ninguna.
   */
  private async ejecutarSentencias(
    motor: MotorSoporte,
    guardado: Record<string, unknown>,
    sentencias: string[],
    basesSentencia: string[],
  ): Promise<void> {
    // Misma preparación que al guardar: cada dato al tipo que necesita el driver, sin
    // depender de cómo quedó en el JSON (ej. "3306" -> 3306, host numérico -> texto).
    const objeto = normalizarObjeto(motor, guardado);
    const problemas = problemasConexionBd(motor, objeto);
    if (problemas.length) {
      // El detalle (`problemas`) lo ve el Super Administrador al guardar la conexión en Configuración.
      throw new SentenciaNoPermitidaError(
        `La conexión "${motor}" en Configuración está incompleta o mal escrita.\nRepórtalo al Super Administrador para que la revise.`,
      );
    }
    // Con túnel, `host` se resuelve desde el bastión: el alias de Docker solo aplica a lo que se conecta directo.
    const conTunel = motor === MotorSoporte.POSTGRES && Boolean(objeto.ssh_host);
    const host = conTunel ? (leerTexto(objeto.host) as string).trim() : resolverHost(leerTexto(objeto.host) ?? '');
    const port = leerNumero(objeto.port) as number;
    const usuario = leerTexto(objeto.username) as string;
    const password = leerTexto(objeto.password) as string;
    if (motor === MotorSoporte.POSTGRES) {
      const database = (leerTexto(objeto.database) as string).trim();
      const otraBase = basesSentencia.find((base) => base && base !== database);
      if (otraBase) {
        throw new SentenciaNoPermitidaError(
          `La sentencia es de otra base de datos.\nIndica "${otraBase}", que no es la base de la conexión "postgres" de Configuración. Escribe la tabla como esquema.tabla.`,
        );
      }
      await this.rawPostgresService.executeEnTransaccion(
        {
          host,
          port,
          usuario,
          password,
          database,
          ssl: objeto.ssl === true,
          ssh: conTunel
            ? {
                host: resolverHost(leerTexto(objeto.ssh_host) as string),
                port: leerNumero(objeto.ssh_port) ?? 22,
                usuario: leerTexto(objeto.ssh_username) as string,
                rutaLlave: process.env.SSH_KEY_PATH?.trim(),
                passphrase: leerTexto(objeto.ssh_passphrase),
              }
            : undefined,
        },
        sentencias,
      );
      return;
    }
    await this.rawMysqlService.executeEnTransaccion({ host, port, usuario, password, database: basesSentencia[0] }, sentencias);
  }

  /** 422: alguna sentencia no es un UPDATE con WHERE ni un INSERT limpio, o se mezclan — el frontend lo muestra como advertencia (amarillo). */
  private exigirSentenciaPermitida(sentencia: string, motor: MotorSoporte): void {
    const validacion = validarSentencia(sentencia, motor);
    if (!validacion.valida) {
      throw new UnprocessableEntityException({ title: TITULO, message: validacion.mensaje });
    }
  }

  /**
   * MySQL (Carteras Propias V1) sin conexión -> indicación de VPN; acceso rechazado, permisos o
   * base inexistente -> mensaje propio (el del driver trae usuario/host/base); cualquier otro
   * error de la sentencia -> detalle técnico (luego pasa por `ocultarDatosConexion`).
   */
  private mensajeError(motor: MotorSoporte, error: unknown): string {
    if (error instanceof SentenciaNoPermitidaError || error instanceof ErrorTunelSsh) {
      return error.message;
    }
    const codigo = (error as { code?: unknown } | null)?.code;
    const sinConexion = typeof codigo === 'string' && CODIGOS_SIN_CONEXION.has(codigo);
    if (motor === MotorSoporte.MYSQL && sinConexion) {
      return MENSAJE_SIN_CONEXION_MYSQL;
    }
    const mensaje = error instanceof Error ? error.message : '';
    if (motor === MotorSoporte.POSTGRES && (sinConexion || MENSAJES_TIMEOUT_POSTGRES.some((texto) => mensaje.includes(texto)))) {
      return MENSAJE_SIN_CONEXION_POSTGRES;
    }
    const deAcceso = mensajeErrorDeAcceso(motor, error);
    if (deAcceso) {
      return deAcceso;
    }
    if (error instanceof ErrorEnSentencia && error.total > 1) {
      return `Error en la sentencia ${error.numero} de ${error.total}; no se aplicó ningún cambio.\n${this.mensajeCorto(error)}`;
    }
    return `Error al ejecutar la sentencia: ${this.mensajeCorto(error)}`;
  }

  private mensajeCorto(error: unknown): string {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido.';
    return mensaje.length > 200 ? `${mensaje.slice(0, 200)}...` : mensaje;
  }

  private async obtenerOFallar(id: number): Promise<Soporte> {
    const soporte = await this.soportes.findOne({ where: { id } });
    if (!soporte) {
      throw new NotFoundException({ title: TITULO, message: 'Registro de soporte no encontrado.' });
    }
    return soporte;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }
}

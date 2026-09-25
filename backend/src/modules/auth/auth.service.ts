import { randomUUID } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Actor, exigirJerarquia } from '../../common/auth/jerarquia-roles.util.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UAParser } from 'ua-parser-js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { NombreRol } from '../roles/rol.entity.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { AccessTokenPayload, RefreshTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { LoginDto } from './dto/login.dto.js';
import { CambiarPasswordDto } from './dto/cambiar-password.dto.js';
import { RecuperarPasswordDto } from './dto/recuperar-password.dto.js';

const BCRYPT_ROUNDS = 10;
const TITULO = 'Login';
const MENSAJE_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.';

/** Contadores de intentos fallidos por acción y usuario (ej. `rate_limit:auth:login:1234567`). */
const CLAVE_INTENTOS = 'rate_limit:auth';
const MAX_INTENTOS_POR_DEFECTO = 5;
const VENTANA_MINUTOS_POR_DEFECTO = 15;

type AccionLimitada = 'login' | 'recuperar';

/** Entero >= 0 de una variable de entorno; vacía, ausente o inválida -> `porDefecto`. */
function leerEnteroEnv(nombre: string, porDefecto: number): number {
  const texto = process.env[nombre]?.trim();
  if (!texto) {
    return porDefecto;
  }
  const valor = Number(texto);
  return Number.isInteger(valor) && valor >= 0 ? valor : porDefecto;
}

/**
 * Límite de intentos fallidos de login y de recuperar contraseña, por usuario: `LOGIN_MAX_INTENTOS`
 * (0 = sin límite) dentro de `LOGIN_VENTANA_MINUTOS`. Se leen en cada intento.
 */
function limiteIntentos(): { max: number; ventanaSegundos: number } {
  const minutos = leerEnteroEnv('LOGIN_VENTANA_MINUTOS', VENTANA_MINUTOS_POR_DEFECTO) || VENTANA_MINUTOS_POR_DEFECTO;
  return { max: leerEnteroEnv('LOGIN_MAX_INTENTOS', MAX_INTENTOS_POR_DEFECTO), ventanaSegundos: minutos * 60 };
}

function errorDemasiadosIntentos(ttlSegundos: number): HttpException {
  const minutos = Math.max(1, Math.ceil(ttlSegundos / 60));
  return new HttpException(
    {
      title: TITULO,
      message: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/** Convierte '15m'/'12h'/'30s'/'2d' al segundero que necesita el TTL de Redis. */
function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Formato de duración de token inválido: "${duration}" (usa algo como "15m" o "12h").`);
  }
  const factores: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * factores[match[2]];
}

export interface TokensEmitidos {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async login(dto: LoginDto, userAgent: string | undefined) {
    await this.exigirIntentosDisponibles('login', dto.usuario);
    const usuario = await this.usuarios.findOne({
      where: { usuario: dto.usuario },
      relations: { rolRef: true },
    });
    if (!usuario || usuario.estadoRegistro === 0 || !(await bcrypt.compare(dto.password, usuario.password))) {
      await this.registrarIntentoFallido('login', dto.usuario);
      throw new UnauthorizedException({ title: TITULO, message: MENSAJE_CREDENCIALES_INVALIDAS });
    }
    await this.redisService.borrarContador(this.claveIntentos('login', dto.usuario));

    const { tipoEquipo, navegador, sistemaOperativo } = this.detectarDispositivo(userAgent);
    usuario.ultimoTipoEquipo = tipoEquipo;
    usuario.ultimoNavegador = navegador;
    usuario.ultimoSistemaOperativo = sistemaOperativo;
    usuario.ultimaFechaLogin = new Date();

    const tokens = await this.emitirTokens(usuario);
    await this.usuarios.save(usuario);

    return {
      message: 'Inicio de sesión exitoso.',
      data: { ...tokens, usuario: this.mapUsuarioAutenticado(usuario) },
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException({ title: TITULO, message: 'El refresh token es inválido o expiró.' });
    }

    const sidActivo = await this.redisService.getSesionActiva(payload.sub);
    if (!sidActivo || sidActivo !== payload.sid) {
      throw new UnauthorizedException({
        title: TITULO,
        message: 'La sesión fue cerrada o reemplazada por un nuevo inicio de sesión.',
      });
    }

    const usuario = await this.usuarios.findOne({ where: { id: payload.sub }, relations: { rolRef: true } });
    if (!usuario || usuario.estadoRegistro === 0) {
      throw new UnauthorizedException({ title: TITULO, message: 'Usuario no encontrado o inactivo.' });
    }
    // La sesión también debe ser la registrada en BD (`refresh_token` = sid): tras un
    // logout, un reseteo asistido o una BD reconstruida, Redis puede conservar el sid viejo.
    if (usuario.refreshToken !== payload.sid) {
      throw new UnauthorizedException({ title: TITULO, message: 'La sesión ya no es válida, inicia sesión nuevamente.' });
    }

    const tokens = await this.emitirTokens(usuario);
    await this.usuarios.save(usuario);

    return { message: 'Sesión renovada.', data: { ...tokens, usuario: this.mapUsuarioAutenticado(usuario) } };
  }

  async cambiarPassword(idUsuario: number, dto: CambiarPasswordDto) {
    const usuario = await this.obtenerUsuarioOFallar(idUsuario);

    // 400 y no 401: un 401 significa "sesión inválida" y el frontend cerraría la sesión.
    if (!(await bcrypt.compare(dto.passwordActual, usuario.password))) {
      throw new BadRequestException({ title: TITULO, message: 'La contraseña actual no es correcta.' });
    }
    usuario.password = await bcrypt.hash(dto.passwordNueva, BCRYPT_ROUNDS);
    usuario.secreto = await bcrypt.hash(dto.secretoNuevo, BCRYPT_ROUNDS);
    usuario.debeCambiarPassword = 0;
    usuario.idUsuario = idUsuario;
    usuario.descripcion = 'Contraseña actualizada por el usuario.';
    await this.usuarios.save(usuario);

    return { message: 'Contraseña actualizada correctamente.' };
  }

  async recuperarPassword(dto: RecuperarPasswordDto) {
    const mensajeInvalido = { title: TITULO, message: 'Usuario o secreto incorrectos.' };
    await this.exigirIntentosDisponibles('recuperar', dto.usuario);
    const usuario = await this.usuarios.findOne({ where: { usuario: dto.usuario } });
    if (!usuario || usuario.estadoRegistro === 0 || !usuario.secreto || !(await bcrypt.compare(dto.secreto, usuario.secreto))) {
      await this.registrarIntentoFallido('recuperar', dto.usuario);
      throw new UnauthorizedException(mensajeInvalido);
    }
    await this.redisService.borrarContador(this.claveIntentos('recuperar', dto.usuario));

    usuario.password = await bcrypt.hash(dto.passwordNueva, BCRYPT_ROUNDS);
    usuario.idUsuario = usuario.id;
    usuario.descripcion = 'Contraseña recuperada mediante secreto.';
    await this.usuarios.save(usuario);

    return { message: 'Contraseña recuperada correctamente, ya puedes iniciar sesión.' };
  }

  private claveIntentos(accion: AccionLimitada, usuario: string): string {
    return `${CLAVE_INTENTOS}:${accion}:${usuario.trim()}`;
  }

  /** 429 si el usuario ya agotó sus intentos fallidos en la ventana actual (antes de comparar la clave). */
  private async exigirIntentosDisponibles(accion: AccionLimitada, usuario: string): Promise<void> {
    const { max } = limiteIntentos();
    if (!max) {
      return;
    }
    const { valor, ttlSegundos } = await this.redisService.leerContador(this.claveIntentos(accion, usuario));
    if (valor >= max) {
      throw errorDemasiadosIntentos(ttlSegundos);
    }
  }

  /**
   * Suma un intento fallido (la ventana empieza en el primero y expira sola). El que agota el
   * límite ya responde 429, para que el usuario sepa cuánto esperar. Un acierto borra el contador.
   */
  private async registrarIntentoFallido(accion: AccionLimitada, usuario: string): Promise<void> {
    const { max, ventanaSegundos } = limiteIntentos();
    if (!max) {
      return;
    }
    const clave = this.claveIntentos(accion, usuario);
    const intentos = await this.redisService.incrementarContador(clave, ventanaSegundos);
    if (intentos >= max) {
      throw errorDemasiadosIntentos((await this.redisService.leerContador(clave)).ttlSegundos);
    }
  }

  async resetearPasswordAsistido(idUsuario: number, passwordTemporal: string, adminIdUsuario: number, actor: Actor) {
    const usuario = await this.obtenerUsuarioOFallar(idUsuario);
    exigirJerarquia(actor, usuario.idRol, TITULO, 'No puedes restablecer la contraseña de un usuario con un rol por encima del tuyo.');

    usuario.password = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);
    usuario.secreto = null;
    usuario.debeCambiarPassword = 1;
    usuario.refreshToken = null;
    usuario.idUsuario = adminIdUsuario;
    usuario.descripcion = 'Contraseña reseteada por un administrador.';
    await this.redisService.borrarSesionActiva(usuario.id);
    await this.usuarios.save(usuario);

    return {
      message: 'Contraseña temporal asignada. El usuario deberá definir contraseña y secreto nuevos al ingresar.',
    };
  }

  async logout(idUsuario: number) {
    await this.redisService.borrarSesionActiva(idUsuario);
    await this.usuarios.update({ id: idUsuario }, { refreshToken: null });
    return { message: 'Sesión cerrada correctamente.' };
  }

  private async emitirTokens(usuario: Usuario): Promise<TokensEmitidos> {
    const sid = randomUUID();
    const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '12h';

    const accessPayload: AccessTokenPayload = {
      sub: usuario.id,
      usuario: usuario.usuario,
      rol: (usuario.rolRef?.rol as NombreRol) ?? NombreRol.DESARROLLADOR,
      idRol: usuario.idRol,
      sid,
      debeCambiarPassword: usuario.debeCambiarPassword === 1,
    };
    const refreshPayload: RefreshTokenPayload = { sub: usuario.id, sid };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      }),
    ]);

    await this.redisService.setSesionActiva(usuario.id, sid, parseDurationToSeconds(refreshExpiresIn));
    usuario.refreshToken = sid;

    return { accessToken, refreshToken, expiresIn: parseDurationToSeconds(accessExpiresIn) };
  }

  private detectarDispositivo(userAgent: string | undefined) {
    const resultado = new UAParser(userAgent ?? '').getResult();
    const tipoEquipo = resultado.device.type === 'mobile' || resultado.device.type === 'tablet' ? 'Móvil' : 'PC';
    const navegador = resultado.browser.name
      ? `${resultado.browser.name} ${resultado.browser.version ?? ''}`.trim()
      : null;
    const sistemaOperativo = resultado.os.name
      ? `${resultado.os.name} ${resultado.os.version ?? ''}`.trim()
      : null;
    return { tipoEquipo, navegador, sistemaOperativo };
  }

  private mapUsuarioAutenticado(usuario: Usuario) {
    return {
      id: usuario.id,
      usuario: usuario.usuario,
      primerNombre: usuario.primerNombre,
      primerApellido: usuario.primerApellido,
      rol: usuario.rolRef?.rol,
      idRol: usuario.idRol,
      debeCambiarPassword: usuario.debeCambiarPassword === 1,
    };
  }

  private async obtenerUsuarioOFallar(idUsuario: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({ where: { id: idUsuario } });
    if (!usuario) {
      throw new NotFoundException({ title: TITULO, message: 'Usuario no encontrado.' });
    }
    return usuario;
  }
}

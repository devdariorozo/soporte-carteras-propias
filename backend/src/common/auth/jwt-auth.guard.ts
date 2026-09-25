import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DEFAULT_RESPONSE_TITLE } from '../envelope/envelope.util.js';
import { RedisService } from '../redis/redis.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from './allow-password-change.decorator.js';
import { AccessTokenPayload } from './jwt-payload.interface.js';

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}

/**
 * Guard global: exige JWT válido y, además, que su `sid` coincida con el guardado en
 * Redis para el usuario (sesión única — ver RedisService y
 * planing/06-seguridad-sesion.md). Si no coincide, la sesión fue cerrada por logout o
 * reemplazada por un login más reciente, aunque el token en sí no haya expirado.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extraerToken(request);
    if (!token) {
      throw new UnauthorizedException({ title: DEFAULT_RESPONSE_TITLE, message: 'Token no proporcionado.' });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException({
        title: DEFAULT_RESPONSE_TITLE,
        message: 'La sesión expiró o el token es inválido, por favor inicia sesión nuevamente.',
      });
    }

    const sidActivo = await this.redisService.getSesionActiva(payload.sub);
    if (!sidActivo || sidActivo !== payload.sid) {
      throw new UnauthorizedException({
        title: DEFAULT_RESPONSE_TITLE,
        message: 'La sesión fue cerrada o reemplazada por un nuevo inicio de sesión.',
      });
    }

    const allowDuringPasswordChange = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DURING_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (payload.debeCambiarPassword && !allowDuringPasswordChange) {
      throw new ForbiddenException({
        title: DEFAULT_RESPONSE_TITLE,
        message: 'Debes actualizar tu contraseña antes de continuar.',
      });
    }

    request.user = payload;
    return true;
  }

  private extraerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length).trim() || null;
  }
}

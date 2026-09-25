import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DEFAULT_RESPONSE_TITLE } from '../envelope/envelope.util.js';
import { NombreRol } from '../../modules/roles/rol.entity.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<NombreRol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rolUsuario = request.user?.rol;
    if (!rolUsuario || !rolesPermitidos.includes(rolUsuario)) {
      throw new ForbiddenException({
        title: DEFAULT_RESPONSE_TITLE,
        message: 'No tienes permiso para realizar esta acción.',
      });
    }
    return true;
  }
}

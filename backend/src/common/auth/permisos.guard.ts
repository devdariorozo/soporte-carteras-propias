import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { DEFAULT_RESPONSE_TITLE } from '../envelope/envelope.util.js';
import { Permiso } from '../../modules/permisos/permiso.entity.js';
import { PermisoRequerido, REQUIERE_PERMISO_KEY } from './requiere-permiso.decorator.js';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Permiso) private readonly permisos: Repository<Permiso>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permisoRequerido = this.reflector.getAllAndOverride<PermisoRequerido>(REQUIERE_PERMISO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permisoRequerido) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const idRol = request.user?.idRol;
    const tienePermiso =
      idRol !== undefined &&
      (await this.permisos.exists({
        where: { idRol, menu: permisoRequerido.menu, permiso: permisoRequerido.accion, estadoRegistro: 1 },
      }));

    if (!tienePermiso) {
      throw new ForbiddenException({
        title: DEFAULT_RESPONSE_TITLE,
        message: 'No tienes permiso para realizar esta acción.',
      });
    }
    return true;
  }
}

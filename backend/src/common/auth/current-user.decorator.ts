import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AccessTokenPayload } from './jwt-payload.interface.js';

/** Extrae el payload del JWT que `JwtAuthGuard` ya adjuntó a `request.user`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as AccessTokenPayload;
});

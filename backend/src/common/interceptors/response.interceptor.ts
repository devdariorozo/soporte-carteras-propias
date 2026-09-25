import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_TITLE_KEY } from '../decorators/response-title.decorator.js';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator.js';
import { DEFAULT_RESPONSE_TITLE, buildSuccessEnvelope } from '../envelope/envelope.util.js';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipEnvelope) {
      return next.handle();
    }

    const title =
      this.reflector.getAllAndOverride<string>(RESPONSE_TITLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RESPONSE_TITLE;

    return next.handle().pipe(map((result) => buildSuccessEnvelope(title, result)));
  }
}

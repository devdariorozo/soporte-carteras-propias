import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DEFAULT_RESPONSE_TITLE, buildErrorEnvelope } from '../envelope/envelope.util.js';

/**
 * Para que un endpoint reporte un `title` de dominio (ej. "Usuarios") en su envelope
 * de error, lanza `new HttpException({ title: 'Usuarios', message: '...' }, status)`.
 * Sin ese `title`, el filtro cae al genérico `Sistema`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let title = DEFAULT_RESPONSE_TITLE;
    let message = 'Ocurrió un error inesperado.';

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const bodyRecord = body as Record<string, unknown>;
        if (typeof bodyRecord.title === 'string') {
          title = bodyRecord.title;
        }
        if (typeof bodyRecord.message === 'string') {
          message = bodyRecord.message;
        } else if (Array.isArray(bodyRecord.message)) {
          message = bodyRecord.message.join(' ');
        }
      }
    } else {
      this.logger.error('Error no controlado', exception as Error);
    }

    response.status(status).json(buildErrorEnvelope(title, message));
  }
}

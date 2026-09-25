import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skip_envelope';

/**
 * Excepción al envelope estándar para respuestas binarias (ver
 * planing/04-api-contratos.md — descarga de Excel de Informes).
 */
export const SkipEnvelope = (): MethodDecorator => SetMetadata(SKIP_ENVELOPE_KEY, true);

import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_PASSWORD_CHANGE_KEY = 'allow_during_password_change';

/**
 * Excluye la ruta del bloqueo del `JwtAuthGuard` cuando `debeCambiarPassword` es
 * `true` (cambio obligatorio en primer acceso o post-reseteo-asistido — ver
 * planing/06-seguridad-sesion.md). Solo `cambiar-password` y `logout` la usan.
 */
export const AllowDuringForcedPasswordChange = (): MethodDecorator =>
  SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);

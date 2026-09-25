import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

const SESSION_KEY_PREFIX = 'auth:session:';

/**
 * Registro server-side de la sesión activa por usuario (ver
 * planing/06-seguridad-sesion.md, nota técnica #3): el JWT es stateless y no se puede
 * invalidar por sí mismo antes de expirar, así que cada request compara el `sid` del
 * token contra el guardado aquí para poder imponer sesión única e invalidar de
 * inmediato en logout/nuevo login.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  });

  async setSesionActiva(idUsuario: number, sid: string, ttlSegundos: number): Promise<void> {
    await this.client.set(`${SESSION_KEY_PREFIX}${idUsuario}`, sid, 'EX', ttlSegundos);
  }

  async getSesionActiva(idUsuario: number): Promise<string | null> {
    return this.client.get(`${SESSION_KEY_PREFIX}${idUsuario}`);
  }

  async borrarSesionActiva(idUsuario: number): Promise<void> {
    await this.client.del(`${SESSION_KEY_PREFIX}${idUsuario}`);
  }

  /**
   * Contador atómico por ventana de tiempo (ej. rate limiting): incrementa `clave` y,
   * solo en el primer incremento de la ventana, le pone `EX ttlSegundos` — así la
   * ventana expira sola sin necesitar un job de limpieza aparte.
   */
  async incrementarContador(clave: string, ttlSegundos: number): Promise<number> {
    const valor = await this.client.incr(clave);
    if (valor === 1) {
      await this.client.expire(clave, ttlSegundos);
    }
    return valor;
  }

  /** Valor actual de un contador y segundos que le quedan a su ventana (0 si no existe). */
  async leerContador(clave: string): Promise<{ valor: number; ttlSegundos: number }> {
    const [valor, ttl] = await Promise.all([this.client.get(clave), this.client.ttl(clave)]);
    return { valor: Number(valor ?? 0), ttlSegundos: Math.max(0, ttl) };
  }

  async borrarContador(clave: string): Promise<void> {
    await this.client.del(clave);
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}

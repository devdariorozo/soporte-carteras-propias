import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

const METODOS_PERMITIDOS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];
const HEADERS_PERMITIDOS = ['Content-Type', 'Authorization'];

/**
 * Política CORS desde `CORS_ORIGENES` del .env: `*` acepta cualquier origen; si no, lista de
 * URLs separadas por coma. Vacía o sin definir, se deniega todo origen cruzado (falla cerrado).
 * El frontend servido por nginx llama a `/api` en su mismo origen, así que no depende de esto.
 */
export function opcionesCors(valor: string | undefined): CorsOptions {
  const origenes = (valor ?? '')
    .split(',')
    .map((origen) => origen.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return {
    origin: origenes.includes('*') ? true : origenes,
    methods: METODOS_PERMITIDOS,
    allowedHeaders: HEADERS_PERMITIDOS,
  };
}

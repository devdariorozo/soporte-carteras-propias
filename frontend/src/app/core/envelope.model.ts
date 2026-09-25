/** Bloque de paginación que agregan los listados (ver planing/04-api-contratos.md). */
export interface PaginationBlock {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/** Envelope estándar de respuesta de la API (ver planing/04-api-contratos.md). */
export interface ResponseEnvelope<T = unknown> {
  status: 'success' | 'error';
  title: string;
  message: string;
  data: T | null;
  pagination?: PaginationBlock | null;
}

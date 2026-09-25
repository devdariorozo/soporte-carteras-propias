export interface PaginationBlock {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ResponseEnvelope<T = unknown> {
  status: 'success' | 'error';
  title: string;
  message: string;
  data: T | null;
  pagination?: PaginationBlock | null;
}

export const DEFAULT_RESPONSE_TITLE = 'Sistema';
export const DEFAULT_SUCCESS_MESSAGE = 'Operación exitosa.';

export interface HandlerResult<T = unknown> {
  message?: string;
  data?: T;
  pagination?: PaginationBlock;
}

export function isHandlerResult(value: unknown): value is HandlerResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('message' in value || 'data' in value || 'pagination' in value)
  );
}

export function buildSuccessEnvelope<T>(title: string, result: HandlerResult<T> | T): ResponseEnvelope<T> {
  if (isHandlerResult(result)) {
    return {
      status: 'success',
      title,
      message: result.message ?? DEFAULT_SUCCESS_MESSAGE,
      data: (result.data ?? null) as T | null,
      ...(result.pagination ? { pagination: result.pagination } : {}),
    };
  }

  return {
    status: 'success',
    title,
    message: DEFAULT_SUCCESS_MESSAGE,
    data: (result ?? null) as T | null,
  };
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

export function buildPaginationBlock(total: number, page: number, limit: number): PaginationBlock {
  return { total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
}

export function buildErrorEnvelope(title: string, message: string): ResponseEnvelope<null> {
  return {
    status: 'error',
    title,
    message,
    data: null,
    pagination: null,
  };
}

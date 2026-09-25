/**
 * Falla de una sentencia dentro de una ejecución en lote: conserva el error original
 * (incluido su `code`, ej. ETIMEDOUT) y dice cuál de las sentencias falló.
 */
export class ErrorEnSentencia extends Error {
  readonly code?: string;

  constructor(
    readonly causa: unknown,
    readonly numero: number,
    readonly total: number,
  ) {
    super(causa instanceof Error ? causa.message : 'Error desconocido.');
    this.code = (causa as { code?: string } | null)?.code;
  }
}

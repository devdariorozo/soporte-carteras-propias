/** Motores de BD de Soporte — el valor es el `configuracion.nombre` de la conexión que se usa al ejecutar. */
export type MotorSoporte = 'mysql' | 'postgres';

export const MOTORES: { label: string; value: MotorSoporte }[] = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgres' },
];

/** Conexión activa de Configuración que ofrece el select Motor de Soporte. */
export interface OpcionMotor {
  nombre: MotorSoporte;
  alcance: string;
}

/** Texto de la opción: motor y alcance (ej. "MySQL - Todas", "PostgreSQL - Base Raiz"). */
export function etiquetaOpcionMotor({ nombre, alcance }: OpcionMotor): string {
  return `${etiquetaMotor(nombre) ?? nombre} - ${alcance}`;
}

export function etiquetaMotor(motor: string | null | undefined): string | null {
  return MOTORES.find((opcion) => opcion.value === motor)?.label ?? null;
}

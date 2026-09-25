import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Política única de contraseña segura — la misma que valida el backend
 * (`common/validators/password-segura.ts`). Cada campo de "contraseña nueva" de la app
 * la usa tanto para validar como para el medidor visual (`app-password-fortaleza`).
 */
export interface RequisitoPassword {
  etiqueta: string;
  cumple: (valor: string) => boolean;
}

export const REQUISITOS_PASSWORD: RequisitoPassword[] = [
  { etiqueta: 'Mínimo 8 caracteres', cumple: (valor) => valor.length >= 8 },
  { etiqueta: 'Una letra mayúscula', cumple: (valor) => /\p{Lu}/u.test(valor) },
  { etiqueta: 'Una letra minúscula', cumple: (valor) => /\p{Ll}/u.test(valor) },
  { etiqueta: 'Un número', cumple: (valor) => /\p{N}/u.test(valor) },
  { etiqueta: 'Un carácter especial', cumple: (valor) => /[^\p{L}\p{N}\s]/u.test(valor) },
];

export type NivelPassword = 'debil' | 'media' | 'fuerte';

/**
 * Fuerte = cumple los 5 requisitos (única válida). Media = cumple 3 o 4. Débil = 2 o menos.
 */
export function nivelPassword(valor: string): NivelPassword {
  const cumplidos = REQUISITOS_PASSWORD.filter((requisito) => requisito.cumple(valor)).length;
  if (cumplidos === REQUISITOS_PASSWORD.length) {
    return 'fuerte';
  }
  return cumplidos >= 3 ? 'media' : 'debil';
}

/** Vacío lo resuelve `Validators.required`; con valor, exige los 5 requisitos. */
export function passwordSeguraValidator(control: AbstractControl): ValidationErrors | null {
  const valor = (control.value as string | null) ?? '';
  if (!valor) {
    return null;
  }
  return REQUISITOS_PASSWORD.every((requisito) => requisito.cumple(valor)) ? null : { passwordInsegura: true };
}

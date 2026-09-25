/**
 * Política única de contraseña segura — la misma que valida el frontend
 * (`core/validators/password-strength.ts`): mínimo 8 caracteres, una mayúscula, una
 * minúscula, un número y un carácter especial (cualquier símbolo que no sea letra,
 * número ni espacio).
 */
export const PASSWORD_SEGURA_REGEX = /^(?=.*\p{Lu})(?=.*\p{Ll})(?=.*\p{N})(?=.*[^\p{L}\p{N}\s]).{8,}$/u;

export const PASSWORD_SEGURA_MENSAJE =
  'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.';

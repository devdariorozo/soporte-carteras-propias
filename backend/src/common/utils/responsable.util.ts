import { In, Repository } from 'typeorm';
import { Usuario } from '../../modules/usuarios/usuario.entity.js';

export type ConResponsable<T> = T & { responsable: string | null };

/** Nombre completo: primer y segundo nombre + primer y segundo apellido, omitiendo los vacíos. */
export function nombreCompleto(usuario: Usuario): string {
  return [usuario.primerNombre, usuario.segundoNombre, usuario.primerApellido, usuario.segundoApellido]
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join(' ');
}

/** Cruce `id_usuario -> nombre completo` (4 campos) para la columna "Responsable" de los listados. */
export async function adjuntarResponsables<T extends { idUsuario: number | null }>(
  usuarios: Repository<Usuario>,
  registros: T[],
): Promise<ConResponsable<T>[]> {
  const ids = [...new Set(registros.map((r) => r.idUsuario).filter((id): id is number => id !== null))];
  const encontrados = ids.length ? await usuarios.findBy({ id: In(ids) }) : [];
  const mapa = new Map(encontrados.map((u) => [u.id, nombreCompleto(u)]));
  return registros.map((registro) =>
    Object.assign(registro, { responsable: registro.idUsuario ? (mapa.get(registro.idUsuario) ?? null) : null }),
  ) as ConResponsable<T>[];
}

import { NombreRol } from '../../modules/roles/rol.entity.js';

export interface AccessTokenPayload {
  sub: number;
  usuario: string;
  rol: NombreRol;
  idRol: number;
  sid: string;
  debeCambiarPassword: boolean;
}

export interface RefreshTokenPayload {
  sub: number;
  sid: string;
}

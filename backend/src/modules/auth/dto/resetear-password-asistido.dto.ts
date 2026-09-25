import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { PASSWORD_SEGURA_MENSAJE, PASSWORD_SEGURA_REGEX } from '../../../common/validators/password-segura.js';

export class ResetearPasswordAsistidoDto {
  @ApiProperty({ description: 'Contraseña temporal asignada por el admin. El usuario deberá cambiarla al reingresar.' })
  @IsString()
  @Matches(PASSWORD_SEGURA_REGEX, { message: PASSWORD_SEGURA_MENSAJE })
  passwordTemporal: string;
}

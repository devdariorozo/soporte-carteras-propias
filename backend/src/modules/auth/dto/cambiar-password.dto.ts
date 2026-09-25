import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_SEGURA_MENSAJE, PASSWORD_SEGURA_REGEX } from '../../../common/validators/password-segura.js';

export class CambiarPasswordDto {
  @ApiProperty({ description: 'Contraseña actual (genérica en primer acceso, temporal tras un reseteo asistido).' })
  @IsString()
  @IsNotEmpty()
  passwordActual: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_SEGURA_REGEX, { message: PASSWORD_SEGURA_MENSAJE })
  passwordNueva: string;

  @ApiProperty({ description: 'Secreto de recuperación — obligatorio en todo cambio de contraseña (se reemplaza el anterior).' })
  @IsString()
  @IsNotEmpty({ message: 'El secreto de recuperación es obligatorio.' })
  @MinLength(3)
  @MaxLength(45)
  secretoNuevo: string;
}

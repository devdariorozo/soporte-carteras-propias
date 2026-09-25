import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_SEGURA_MENSAJE, PASSWORD_SEGURA_REGEX } from '../../../common/validators/password-segura.js';

export class RecuperarPasswordDto {
  @ApiProperty({ example: '1111111111' })
  @IsString()
  @IsNotEmpty()
  usuario: string;

  @ApiProperty({ description: 'Secreto definido por el usuario en su primer acceso.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(45)
  secreto: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_SEGURA_REGEX, { message: PASSWORD_SEGURA_MENSAJE })
  passwordNueva: string;
}

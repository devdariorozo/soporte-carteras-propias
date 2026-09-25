import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_SEGURA_MENSAJE, PASSWORD_SEGURA_REGEX } from '../../../common/validators/password-segura.js';
import { TELEFONO_MENSAJE, TELEFONO_REGEX, formatearTelefono } from '../../../common/utils/telefono.util.js';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);
const formatoTelefono = ({ value }: { value: unknown }) => (typeof value === 'string' ? formatearTelefono(value) : value);

export class CrearUsuarioDto {
  @ApiProperty({ example: '1.111.111.111', description: 'Con puntos de miles, tal como se ve en el input.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(21)
  numeroDocumento: string;

  @ApiProperty({ example: '1111111111', description: 'Documento sin puntos — es el identificador de login.' })
  @IsString()
  @IsNotEmpty()
  usuario: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(45)
  primerNombre: string;

  @ApiPropertyOptional()
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(45)
  segundoNombre?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(45)
  primerApellido: string;

  @ApiPropertyOptional()
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(45)
  segundoApellido?: string;

  @ApiProperty({ example: '321 256 5689', description: '10 dígitos; se guarda con el formato 3-3-4.' })
  @Transform(formatoTelefono)
  @IsString()
  @Matches(TELEFONO_REGEX, { message: TELEFONO_MENSAJE })
  numeroContacto: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  idRol: number;

  @ApiProperty()
  @IsEmail()
  correo: string;

  @ApiProperty({ description: 'Contraseña temporal asignada por el admin. El usuario deberá cambiarla al ingresar.' })
  @IsString()
  @Matches(PASSWORD_SEGURA_REGEX, { message: PASSWORD_SEGURA_MENSAJE })
  passwordTemporal: string;

  @ApiPropertyOptional({ example: 'Analista del equipo de cartera.' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descripcion?: string;
}

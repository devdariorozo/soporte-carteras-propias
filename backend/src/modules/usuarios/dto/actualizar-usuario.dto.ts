import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TELEFONO_MENSAJE, TELEFONO_REGEX, formatearTelefono } from '../../../common/utils/telefono.util.js';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);
const formatoTelefono = ({ value }: { value: unknown }) => (typeof value === 'string' ? formatearTelefono(value) : value);

export class ActualizarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(21)
  numeroDocumento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usuario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(45)
  primerNombre?: string;

  @ApiPropertyOptional()
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(45)
  segundoNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(45)
  primerApellido?: string;

  @ApiPropertyOptional()
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(45)
  segundoApellido?: string;

  @ApiPropertyOptional({ example: '321 256 5689', description: '10 dígitos; se guarda con el formato 3-3-4.' })
  @Transform(formatoTelefono)
  @IsOptional()
  @IsString()
  @Matches(TELEFONO_REGEX, { message: TELEFONO_MENSAJE })
  numeroContacto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  idRol?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiPropertyOptional()
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descripcion?: string;

  @ApiPropertyOptional({ description: '1=Activo, 0=Inactivo' })
  @IsOptional()
  @IsIn([0, 1])
  estadoRegistro?: number;
}

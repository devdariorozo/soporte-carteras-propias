import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MotorSoporte } from '../soporte.entity.js';

/** Nunca `estadoSoporte` — ese solo transiciona vía `POST /soporte/:id/ejecutar`. */
export class ActualizarSoporteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cliente?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  idNovedad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  mensajeWhatsapp?: string;

  @ApiPropertyOptional({ enum: MotorSoporte })
  @IsOptional()
  @IsEnum(MotorSoporte)
  motor?: MotorSoporte;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  sentencia?: string;

  @ApiPropertyOptional({ description: '1=Activo, 0=Inactivo' })
  @IsOptional()
  @IsIn([0, 1])
  estadoRegistro?: number;
}

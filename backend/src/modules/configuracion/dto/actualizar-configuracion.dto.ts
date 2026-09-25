import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EsObjetoConfiguracion } from './objeto-configuracion.validator.js';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class ActualizarConfiguracionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(45)
  nombre?: string;

  @ApiPropertyOptional({ description: 'A qué bases aplica la conexión (3 a 45 caracteres).' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(45)
  alcance?: string;

  @ApiPropertyOptional({ description: 'JSON plano — reemplaza por completo los pares clave/valor guardados (texto, número, sí/no o lista).' })
  @IsOptional()
  @EsObjetoConfiguracion()
  objeto?: Record<string, unknown>;

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

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class ActualizarRolDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(45)
  rol?: string;

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

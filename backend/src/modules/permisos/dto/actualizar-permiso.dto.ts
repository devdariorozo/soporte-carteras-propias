import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccionPermiso } from '../permiso.entity.js';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class ActualizarPermisoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  idRol?: number;

  @ApiPropertyOptional({ description: 'Debe ser igual al nombre de una opción de menú activa.' })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  menu?: string;

  @ApiPropertyOptional({ enum: AccionPermiso })
  @IsOptional()
  @IsEnum(AccionPermiso)
  permiso?: AccionPermiso;

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

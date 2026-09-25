import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccionPermiso } from '../permiso.entity.js';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class CrearPermisoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  idRol: number;

  @ApiProperty({ example: 'Roles', description: 'Debe ser igual al nombre de una opción de menú activa.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(45)
  menu: string;

  @ApiProperty({ enum: AccionPermiso })
  @IsEnum(AccionPermiso)
  permiso: AccionPermiso;

  @ApiPropertyOptional({ example: 'Permiso para consultar el módulo de roles.' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descripcion?: string;
}

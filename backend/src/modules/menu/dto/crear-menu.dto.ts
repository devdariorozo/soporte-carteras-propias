import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class CrearMenuDto {
  @ApiProperty({ example: 'Administración' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(45)
  apartado: string;

  @ApiProperty({ example: 'Roles' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(45)
  menu: string;

  @ApiProperty({ example: '/admin/roles' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Matches(/^\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/, {
    message: 'ruta debe ser una ruta válida, ej. /admin/roles.',
  })
  ruta: string;

  @ApiProperty({ example: 'pi pi-shield' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(45)
  icono: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  orden: number;

  @ApiPropertyOptional({ example: 'Administración de roles del sistema.' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descripcion?: string;
}

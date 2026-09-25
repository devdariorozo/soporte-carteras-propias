import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class CrearRolDto {
  @ApiProperty({ example: 'Supervisor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(45)
  rol: string;

  @ApiPropertyOptional({ example: 'Rol para supervisión de carteras.' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descripcion?: string;
}

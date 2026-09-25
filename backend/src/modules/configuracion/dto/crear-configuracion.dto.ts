import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EsObjetoConfiguracion } from './objeto-configuracion.validator.js';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class CrearConfiguracionDto {
  @ApiProperty({ example: 'mysql' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(45)
  nombre: string;

  @ApiProperty({ example: 'Todas', description: 'A qué bases aplica la conexión (3 a 45 caracteres).' })
  @IsString()
  @MinLength(3)
  @MaxLength(45)
  alcance: string;

  @ApiProperty({
    description: 'JSON plano — pares clave/valor; cada valor es texto, número, sí/no o lista.',
    example: { host: 'localhost', port: 3306, database: 'db_soporte_real', username: 'root', password: 'root' },
  })
  @EsObjetoConfiguracion()
  objeto: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Conexión de solo lectura para los informes.' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descripcion?: string;
}

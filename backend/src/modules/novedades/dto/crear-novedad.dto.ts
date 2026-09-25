import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const vacioComoIndefinido = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class CrearNovedadDto {
  @ApiProperty({ example: 'Promesa de pago no reflejada' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(45)
  novedad: string;

  @ApiPropertyOptional({ example: 'Casos donde la promesa de pago no se refleja en el aplicativo.' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  descripcion?: string;
}

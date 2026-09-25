import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BuscarClientesDto {
  @ApiPropertyOptional({ description: 'Texto a buscar dentro del nombre del cliente.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

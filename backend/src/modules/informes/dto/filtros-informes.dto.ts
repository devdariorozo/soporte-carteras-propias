import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from '../../../common/dto/paginacion-query.dto.js';
import { EstadoSoporte } from '../../soporte/soporte.entity.js';

const comoArregloDeTexto = ({ value }: { value: unknown }) =>
  value === undefined ? value : Array.isArray(value) ? value : [value];

const comoArregloDeNumeros = ({ value }: { value: unknown }) => {
  if (value === undefined) return value;
  const arreglo = Array.isArray(value) ? value : [value];
  return arreglo.map(Number);
};

export class FiltrosInformesDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ description: 'YYYY-MM-DD, inclusive. Sin filtros de fecha, se acota al día actual.' })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD, inclusive.' })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @Transform(comoArregloDeNumeros)
  @IsArray()
  @IsInt({ each: true })
  idNovedad?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @Transform(comoArregloDeNumeros)
  @IsArray()
  @IsInt({ each: true })
  idUsuario?: number[];

  @ApiPropertyOptional({ enum: EstadoSoporte, isArray: true })
  @IsOptional()
  @Transform(comoArregloDeTexto)
  @IsArray()
  @IsIn(Object.values(EstadoSoporte), { each: true })
  estadoSoporte?: EstadoSoporte[];
}

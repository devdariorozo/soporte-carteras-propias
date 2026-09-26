import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';
import { comoArregloDeNumeros, comoArregloDeTexto } from '../../../common/utils/query-arreglo.util.js';
import { MotorSoporte } from '../../soporte/soporte.entity.js';

export class FiltrosTableroDto {
  @ApiPropertyOptional({ description: 'YYYY-MM-DD, inclusive. Sin fechas, se acota al mes actual.' })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD, inclusive. Máximo 366 días de rango.' })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ type: [Number], description: 'Integrantes (responsables del soporte).' })
  @IsOptional()
  @Transform(comoArregloDeNumeros)
  @IsArray()
  @IsInt({ each: true })
  idUsuario?: number[];

  @ApiPropertyOptional({ enum: MotorSoporte, isArray: true })
  @IsOptional()
  @Transform(comoArregloDeTexto)
  @IsArray()
  @IsIn(Object.values(MotorSoporte), { each: true })
  motor?: MotorSoporte[];

  @ApiPropertyOptional({ type: [Number], description: 'Filtro cruzado desde el top 10 de novedades.' })
  @IsOptional()
  @Transform(comoArregloDeNumeros)
  @IsArray()
  @IsInt({ each: true })
  idNovedad?: number[];
}

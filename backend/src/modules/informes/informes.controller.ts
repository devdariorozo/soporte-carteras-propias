import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { SkipEnvelope } from '../../common/decorators/skip-envelope.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { InformesService } from './informes.service.js';
import { FiltrosInformesDto } from './dto/filtros-informes.dto.js';

@ApiTags('Informes')
@ApiBearerAuth()
@Controller('informes')
@ResponseTitle('Informes')
export class InformesController {
  constructor(private readonly informesService: InformesService) {}

  @Get()
  @RequierePermiso(ModuloPermiso.INFORMES, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista los registros de soporte (paginado) según los filtros — sin filtros, acota al día actual.' })
  listar(@Query() filtros: FiltrosInformesDto) {
    return this.informesService.listar(filtros);
  }

  @Get('usuarios')
  @RequierePermiso(ModuloPermiso.INFORMES, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Usuarios responsables de registros de soporte (para el filtro Usuario del informe).' })
  opcionesUsuarios() {
    return this.informesService.opcionesUsuarios();
  }

  @Get('resumen')
  @RequierePermiso(ModuloPermiso.INFORMES, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Conteo por estado_soporte (para las tarjetas de resumen) — ignora el filtro de estado.' })
  resumen(@Query() filtros: FiltrosInformesDto) {
    return this.informesService.resumen(filtros);
  }

  @Get('exportar')
  @RequierePermiso(ModuloPermiso.INFORMES, AccionPermiso.CONSULTAR)
  @SkipEnvelope()
  @ApiOperation({ summary: 'Descarga en Excel el conjunto filtrado completo (sin paginar) — excepción binaria al envelope.' })
  async exportar(@Query() filtros: FiltrosInformesDto, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const buffer = await this.informesService.exportarExcel(filtros);
    const fecha = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=informes-soporte-${fecha}.xlsx`,
    });
    return new StreamableFile(buffer);
  }
}

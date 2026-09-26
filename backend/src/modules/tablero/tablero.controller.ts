import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { NombreRol } from '../roles/rol.entity.js';
import { InformesService } from '../informes/informes.service.js';
import { TableroService } from './tablero.service.js';
import { FiltrosTableroDto } from './dto/filtros-tablero.dto.js';

/** Doble candado: solo Super Administrador y Administrador, y además con su permiso `Tablero → Consultar`. */
@ApiTags('Tablero')
@ApiBearerAuth()
@Controller('tablero')
@ResponseTitle('Tablero')
@Roles(NombreRol.SUPER_ADMINISTRADOR, NombreRol.ADMINISTRADOR)
export class TableroController {
  constructor(
    private readonly tableroService: TableroService,
    private readonly informesService: InformesService,
  ) {}

  @Get('kpis')
  @RequierePermiso(ModuloPermiso.TABLERO, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Indicadores, ranking de integrantes y top 10 de novedades del rango — sin fechas, mes actual.' })
  kpis(@Query() filtros: FiltrosTableroDto) {
    return this.tableroService.kpis(filtros);
  }

  @Get('usuarios')
  @RequierePermiso(ModuloPermiso.TABLERO, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Responsables de registros de soporte (para el filtro Integrante), igual que /informes/usuarios.' })
  opcionesUsuarios() {
    return this.informesService.opcionesUsuarios();
  }
}

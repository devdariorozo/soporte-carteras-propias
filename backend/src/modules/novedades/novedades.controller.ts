import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { NovedadesService } from './novedades.service.js';
import { CrearNovedadDto } from './dto/crear-novedad.dto.js';
import { ActualizarNovedadDto } from './dto/actualizar-novedad.dto.js';

@ApiTags('Novedades')
@ApiBearerAuth()
@Controller('novedades')
@ResponseTitle('Novedades')
export class NovedadesController {
  constructor(private readonly novedadesService: NovedadesService) {}

  @Get('opciones')
  @RequierePermiso(ModuloPermiso.NOVEDADES, AccionPermiso.OPCIONES)
  @ApiOperation({ summary: 'Novedades activas (id + texto) para selects (Soporte, filtros de Informes).' })
  opciones() {
    return this.novedadesService.opciones();
  }

  @Get()
  @RequierePermiso(ModuloPermiso.NOVEDADES, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista las novedades (paginado).' })
  findAll(@Query() query: PaginacionQueryDto) {
    return this.novedadesService.findAll(query);
  }

  @Get(':id')
  @RequierePermiso(ModuloPermiso.NOVEDADES, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Consulta una novedad por id.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.novedadesService.findOne(id);
  }

  @Post()
  @RequierePermiso(ModuloPermiso.NOVEDADES, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Crea una novedad.' })
  create(@Body() dto: CrearNovedadDto, @CurrentUser() user: AccessTokenPayload) {
    return this.novedadesService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequierePermiso(ModuloPermiso.NOVEDADES, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Actualiza una novedad.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarNovedadDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.novedadesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequierePermiso(ModuloPermiso.NOVEDADES, AccionPermiso.ELIMINAR)
  @ApiOperation({ summary: 'Elimina (soft delete) una novedad.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.novedadesService.remove(id, user.sub);
  }
}

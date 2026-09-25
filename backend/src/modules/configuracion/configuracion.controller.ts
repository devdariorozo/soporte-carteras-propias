import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { ConfiguracionService } from './configuracion.service.js';
import { CrearConfiguracionDto } from './dto/crear-configuracion.dto.js';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto.js';

@ApiTags('Configuración')
@ApiBearerAuth()
@Controller('configuracion')
@ResponseTitle('Configuración')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @RequierePermiso(ModuloPermiso.CONFIGURACION, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista la configuración (paginado).' })
  findAll(@Query() query: PaginacionQueryDto) {
    return this.configuracionService.findAll(query);
  }

  @Get(':id')
  @RequierePermiso(ModuloPermiso.CONFIGURACION, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Consulta una fila de configuración por id.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.configuracionService.findOne(id);
  }

  @Post()
  @RequierePermiso(ModuloPermiso.CONFIGURACION, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Crea una nueva versión — desactiva automáticamente la anterior del mismo nombre.' })
  create(@Body() dto: CrearConfiguracionDto, @CurrentUser() user: AccessTokenPayload) {
    return this.configuracionService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequierePermiso(ModuloPermiso.CONFIGURACION, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Actualiza nombre, alcance, objeto, descripción y/o estado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarConfiguracionDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.configuracionService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequierePermiso(ModuloPermiso.CONFIGURACION, AccionPermiso.ELIMINAR)
  @ApiOperation({ summary: 'Elimina (soft delete) una fila de configuración.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.configuracionService.remove(id, user.sub);
  }
}

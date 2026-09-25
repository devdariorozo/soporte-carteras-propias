import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { SoporteService } from './soporte.service.js';
import { CrearSoporteDto } from './dto/crear-soporte.dto.js';
import { ActualizarSoporteDto } from './dto/actualizar-soporte.dto.js';
import { BuscarClientesDto } from './dto/buscar-clientes.dto.js';

@ApiTags('Soporte')
@ApiBearerAuth()
@Controller('soporte')
@ResponseTitle('Soporte')
export class SoporteController {
  constructor(private readonly soporteService: SoporteService) {}

  @Get()
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista los registros de soporte (paginado).' })
  findAll(@Query() query: PaginacionQueryDto) {
    return this.soporteService.findAll(query);
  }

  @Get('clientes')
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Clientes ya registrados que contienen el texto (autocompletado del formulario de Soporte).' })
  clientes(@Query() query: BuscarClientesDto) {
    return this.soporteService.clientes(query.q);
  }

  @Get('motores')
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Opciones del select Motor: conexiones activas de Configuración (nombre y alcance, sin repetir).' })
  motores() {
    return this.soporteService.motores();
  }

  @Get(':id')
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Consulta un registro de soporte por id.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.soporteService.findOne(id);
  }

  @Post()
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Crea un registro de soporte (arranca en estado Creado, sin ejecutar todavía).' })
  create(@Body() dto: CrearSoporteDto, @CurrentUser() user: AccessTokenPayload) {
    return this.soporteService.create(dto, user.sub);
  }

  @Post(':id/ejecutar')
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Ejecuta la sentencia contra el servidor de las carteras propias (Creado/Error -> En proceso -> Completado|Error).' })
  ejecutar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.soporteService.ejecutar(id, user.sub);
  }

  @Patch(':id')
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Actualiza un registro de soporte (nunca el estado — usar /ejecutar).' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarSoporteDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.soporteService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequierePermiso(ModuloPermiso.SOPORTE, AccionPermiso.ELIMINAR)
  @ApiOperation({ summary: 'Elimina (soft delete) un registro de soporte.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.soporteService.remove(id, user.sub);
  }
}

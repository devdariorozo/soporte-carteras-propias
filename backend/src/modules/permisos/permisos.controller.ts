import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { AccionPermiso, ModuloPermiso } from './permiso.entity.js';
import { PermisosService } from './permisos.service.js';
import { CrearPermisoDto } from './dto/crear-permiso.dto.js';
import { ActualizarPermisoDto } from './dto/actualizar-permiso.dto.js';

@ApiTags('Permisos')
@ApiBearerAuth()
@Controller('permisos')
@ResponseTitle('Permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get('mis-permisos')
  @ApiOperation({ summary: 'Permisos (módulo + acción) del rol del usuario autenticado — arma el menú en el frontend.' })
  misPermisos(@CurrentUser() user: AccessTokenPayload) {
    return this.permisosService.misPermisos(user.idRol);
  }

  @Get()
  @RequierePermiso(ModuloPermiso.PERMISOS, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista los permisos (paginado) — de roles del nivel del usuario hacia abajo.' })
  findAll(@Query() query: PaginacionQueryDto, @CurrentUser() user: AccessTokenPayload) {
    return this.permisosService.findAll(query, user);
  }

  @Get(':id')
  @RequierePermiso(ModuloPermiso.PERMISOS, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Consulta un permiso por id.' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.permisosService.findOne(id, user);
  }

  @Post()
  @RequierePermiso(ModuloPermiso.PERMISOS, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Crea un permiso (rol + módulo + acción).' })
  create(@Body() dto: CrearPermisoDto, @CurrentUser() user: AccessTokenPayload) {
    return this.permisosService.create(dto, user.sub, user);
  }

  @Patch(':id')
  @RequierePermiso(ModuloPermiso.PERMISOS, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Actualiza un permiso.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPermisoDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.permisosService.update(id, dto, user.sub, user);
  }

  @Delete(':id')
  @RequierePermiso(ModuloPermiso.PERMISOS, AccionPermiso.ELIMINAR)
  @ApiOperation({ summary: 'Elimina (soft delete) un permiso.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.permisosService.remove(id, user.sub, user);
  }
}

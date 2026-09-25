import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { RolesService } from './roles.service.js';
import { CrearRolDto } from './dto/crear-rol.dto.js';
import { ActualizarRolDto } from './dto/actualizar-rol.dto.js';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@ResponseTitle('Roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('opciones')
  @RequierePermiso(ModuloPermiso.ROLES, AccionPermiso.OPCIONES)
  @ApiOperation({ summary: 'Roles activos (id + nombre) para selects — del nivel del usuario hacia abajo.' })
  opciones(@CurrentUser() user: AccessTokenPayload) {
    return this.rolesService.opciones(user);
  }

  @Get()
  @RequierePermiso(ModuloPermiso.ROLES, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista los roles (paginado) — del nivel del usuario hacia abajo.' })
  findAll(@Query() query: PaginacionQueryDto, @CurrentUser() user: AccessTokenPayload) {
    return this.rolesService.findAll(query, user);
  }

  @Get(':id')
  @RequierePermiso(ModuloPermiso.ROLES, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Consulta un rol por id.' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.rolesService.findOne(id, user);
  }

  @Post()
  @RequierePermiso(ModuloPermiso.ROLES, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Crea un rol.' })
  create(@Body() dto: CrearRolDto, @CurrentUser() user: AccessTokenPayload) {
    return this.rolesService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequierePermiso(ModuloPermiso.ROLES, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Actualiza un rol.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarRolDto, @CurrentUser() user: AccessTokenPayload) {
    return this.rolesService.update(id, dto, user.sub, user);
  }

  @Delete(':id')
  @RequierePermiso(ModuloPermiso.ROLES, AccionPermiso.ELIMINAR)
  @ApiOperation({ summary: 'Elimina (soft delete) un rol.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.rolesService.remove(id, user.sub, user);
  }
}

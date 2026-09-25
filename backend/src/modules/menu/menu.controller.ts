import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { MenuService } from './menu.service.js';
import { CrearMenuDto } from './dto/crear-menu.dto.js';
import { ActualizarMenuDto } from './dto/actualizar-menu.dto.js';

@ApiTags('Menú')
@ApiBearerAuth()
@Controller('menu')
@ResponseTitle('Menú')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('activos')
  @ApiOperation({ summary: 'Opciones de menú activas, ordenadas — arma la sidebar (cualquier usuario autenticado).' })
  activos() {
    return this.menuService.activos();
  }

  @Get()
  @RequierePermiso(ModuloPermiso.MENU, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista las opciones de menú (paginado).' })
  findAll(@Query() query: PaginacionQueryDto) {
    return this.menuService.findAll(query);
  }

  @Get(':id')
  @RequierePermiso(ModuloPermiso.MENU, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Consulta una opción de menú por id.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.findOne(id);
  }

  @Post()
  @RequierePermiso(ModuloPermiso.MENU, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Crea una opción de menú.' })
  create(@Body() dto: CrearMenuDto, @CurrentUser() user: AccessTokenPayload) {
    return this.menuService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequierePermiso(ModuloPermiso.MENU, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Actualiza una opción de menú.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarMenuDto, @CurrentUser() user: AccessTokenPayload) {
    return this.menuService.update(id, dto, user.sub, user);
  }

  @Delete(':id')
  @RequierePermiso(ModuloPermiso.MENU, AccionPermiso.ELIMINAR)
  @ApiOperation({ summary: 'Elimina (soft delete) una opción de menú.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.menuService.remove(id, user.sub, user);
  }
}

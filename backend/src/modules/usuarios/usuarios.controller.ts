import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { RequierePermiso } from '../../common/auth/requiere-permiso.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { AccionPermiso, ModuloPermiso } from '../permisos/permiso.entity.js';
import { UsuariosService } from './usuarios.service.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
@ResponseTitle('Usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('opciones')
  @RequierePermiso(ModuloPermiso.USUARIOS, AccionPermiso.OPCIONES)
  @ApiOperation({ summary: 'Usuarios activos (id + nombre) para selects — de roles del nivel del usuario hacia abajo.' })
  opciones(@CurrentUser() user: AccessTokenPayload) {
    return this.usuariosService.opciones(user);
  }

  @Get()
  @RequierePermiso(ModuloPermiso.USUARIOS, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Lista los usuarios (paginado) — de roles del nivel del usuario hacia abajo.' })
  findAll(@Query() query: PaginacionQueryDto, @CurrentUser() user: AccessTokenPayload) {
    return this.usuariosService.findAll(query, user);
  }

  @Get(':id')
  @RequierePermiso(ModuloPermiso.USUARIOS, AccionPermiso.CONSULTAR)
  @ApiOperation({ summary: 'Consulta un usuario por id.' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.usuariosService.findOne(id, user);
  }

  @Post()
  @RequierePermiso(ModuloPermiso.USUARIOS, AccionPermiso.CREAR)
  @ApiOperation({ summary: 'Crea un usuario con una contraseña temporal (deberá cambiarla al ingresar).' })
  create(@Body() dto: CrearUsuarioDto, @CurrentUser() user: AccessTokenPayload) {
    return this.usuariosService.create(dto, user.sub, user);
  }

  @Patch(':id')
  @RequierePermiso(ModuloPermiso.USUARIOS, AccionPermiso.EDITAR)
  @ApiOperation({ summary: 'Actualiza un usuario (no cambia contraseña/secreto — usar los endpoints de auth).' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.usuariosService.update(id, dto, user.sub, user);
  }

  @Delete(':id')
  @RequierePermiso(ModuloPermiso.USUARIOS, AccionPermiso.ELIMINAR)
  @ApiOperation({ summary: 'Elimina (soft delete) un usuario.' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AccessTokenPayload) {
    return this.usuariosService.remove(id, user.sub, user);
  }
}

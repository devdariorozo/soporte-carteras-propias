import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permiso } from './permiso.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { Menu } from '../menu/menu.entity.js';
import { PermisosController } from './permisos.controller.js';
import { PermisosService } from './permisos.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Permiso, Usuario, Menu])],
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}

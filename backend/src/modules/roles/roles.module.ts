import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rol } from './rol.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Rol, Usuario])],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './menu.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { MenuController } from './menu.controller.js';
import { MenuService } from './menu.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Menu, Usuario])],
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}

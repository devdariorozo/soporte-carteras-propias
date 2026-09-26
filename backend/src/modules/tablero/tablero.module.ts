import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Soporte } from '../soporte/soporte.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { InformesModule } from '../informes/informes.module.js';
import { TableroController } from './tablero.controller.js';
import { TableroService } from './tablero.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Soporte, Usuario]), InformesModule],
  controllers: [TableroController],
  providers: [TableroService],
})
export class TableroModule {}

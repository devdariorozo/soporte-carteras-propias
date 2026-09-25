import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Soporte } from '../soporte/soporte.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { InformesController } from './informes.controller.js';
import { InformesService } from './informes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Soporte, Usuario])],
  controllers: [InformesController],
  providers: [InformesService],
})
export class InformesModule {}

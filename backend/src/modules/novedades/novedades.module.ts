import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Novedad } from './novedad.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { NovedadesController } from './novedades.controller.js';
import { NovedadesService } from './novedades.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Novedad, Usuario])],
  controllers: [NovedadesController],
  providers: [NovedadesService],
})
export class NovedadesModule {}

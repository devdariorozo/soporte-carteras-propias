import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { RawMysqlService } from '../../common/raw-db/raw-mysql.service.js';
import { RawPostgresService } from '../../common/raw-db/raw-postgres.service.js';
import { ConfiguracionModule } from '../configuracion/configuracion.module.js';
import { Soporte } from './soporte.entity.js';
import { SoporteController } from './soporte.controller.js';
import { SoporteService } from './soporte.service.js';
import { EjecucionProcessor } from './ejecucion.processor.js';
import { COLA_EJECUCION_SENTENCIAS } from './ejecucion.constants.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Soporte]),
    ConfiguracionModule,
    BullModule.registerQueue({ name: COLA_EJECUCION_SENTENCIAS }),
  ],
  controllers: [SoporteController],
  providers: [SoporteService, RawMysqlService, RawPostgresService, EjecucionProcessor],
})
export class SoporteModule {}

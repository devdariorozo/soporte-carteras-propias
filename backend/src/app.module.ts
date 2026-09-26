import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { dataSourceOptions } from './database/data-source.js';
import { HealthModule } from './health/health.module.js';
import { RawMysqlService } from './common/raw-db/raw-mysql.service.js';
import { RedisModule } from './common/redis/redis.module.js';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard.js';
import { RolesGuard } from './common/auth/roles.guard.js';
import { PermisosGuard } from './common/auth/permisos.guard.js';
import { Permiso } from './modules/permisos/permiso.entity.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { PermisosModule } from './modules/permisos/permisos.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { NovedadesModule } from './modules/novedades/novedades.module.js';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module.js';
import { SoporteModule } from './modules/soporte/soporte.module.js';
import { InformesModule } from './modules/informes/informes.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { TableroModule } from './modules/tablero/tablero.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([Permiso]),
    JwtModule.register({}),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    RedisModule,
    HealthModule,
    AuthModule,
    RolesModule,
    PermisosModule,
    UsuariosModule,
    NovedadesModule,
    ConfiguracionModule,
    SoporteModule,
    InformesModule,
    TableroModule,
    MenuModule,
  ],
  providers: [
    RawMysqlService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
  exports: [RawMysqlService],
})
export class AppModule {}

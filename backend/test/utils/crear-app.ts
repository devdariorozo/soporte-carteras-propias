import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from '../../src/app.module.js';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';

/** Replica exactamente el bootstrap de `src/main.ts` para las pruebas e2e. */
export async function crearApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

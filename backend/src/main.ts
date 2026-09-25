import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { opcionesCors } from './common/cors/opciones-cors.util.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(opcionesCors(process.env.CORS_ORIGENES));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Soporte Carteras Propias — API')
    .setDescription(
      'Registro y ejecución de sentencias contra las bases de datos de las carteras propias. ' +
        'Todas las respuestas siguen el envelope estándar (ver planing/04-api-contratos.md).',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    // Mismo orden que el menú final administrado en el módulo Menú (ver plan de
    // trabajo) — Login/Sistema no son opciones de menú, quedan primero.
    .addTag('Sistema')
    .addTag('Login')
    .addTag('Configuración')
    .addTag('Roles')
    .addTag('Menú')
    .addTag('Permisos')
    .addTag('Usuarios')
    .addTag('Novedades')
    .addTag('Informes')
    .addTag('Soporte')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

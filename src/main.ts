import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS - permitir peticiones desde cualquier origen (IMPORTANTE: debe ir antes de los assets estáticos)
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
  });

  // Servir archivos estáticos (imágenes de perfil, etc.) desde la carpeta uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
    },
  });

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: false,
      transform: true,
    }),
  );

  // Swagger / OpenAPI - documentación en /api/docs
  const config = new DocumentBuilder()
    .setTitle('U-Ride API')
    .setDescription('Sistema de viajes compartidos para estudiantes universitarios')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación y registro')
    .addTag('users', 'Gestión de usuarios')
    .addTag('trips', 'Viajes compartidos')
    .addTag('reports', 'Reportes de conducta')
    .addTag('admin', 'Administración')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Puerto desde variable de entorno
  const port = process.env.PORT || 3000;

  // Escuchar en 0.0.0.0 para que Docker pueda enrutar las peticiones
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 U-Ride Backend corriendo en: http://0.0.0.0:${port}`);
  console.log(`📖 Swagger docs en: http://0.0.0.0:${port}/api/docs`);
  console.log(`💚 Health check en: http://0.0.0.0:${port}/health`);
}
bootstrap();

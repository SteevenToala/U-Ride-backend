import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS - permite peticiones desde el admin web panel y apps móviles
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

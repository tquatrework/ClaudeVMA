import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Archive Document Service')
    .setDescription(
      'Centralise les archives pédagogiques et les documents liés aux activités VisioMath. ' +
      'Fournit des vues chronologiques et calendrier, avec contrôle d\'accès par rôle. ' +
      'Phase 2 — priorité medium.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = process.env.PORT ?? 3012;
  await app.listen(port);
  console.log(`[archive-document-service] listening on port ${port}`);
}
bootstrap();

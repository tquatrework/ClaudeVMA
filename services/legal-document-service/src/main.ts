import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Legal Document Service')
    .setDescription(
      'Manages legal documents (mandats clients, contrats formateurs), ' +
      'legal templates editable by administrateur_financier, ' +
      'and immutable signature records.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3009;
  await app.listen(port);
  console.log(`[legal-document-service] listening on port ${port}`);
}
bootstrap();

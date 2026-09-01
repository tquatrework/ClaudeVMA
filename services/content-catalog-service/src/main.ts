import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { EXERCISE_JSON_BODY_MAX_BYTES } from './exercises/exercise.constants';

async function bootstrap() {
  // bodyParser désactivé par défaut puis reconfiguré explicitement avec un
  // plafond plus élevé que le défaut Express (100 Ko) — nécessaire depuis
  // que les images d'exercice s'embarquent en base64 dans le corps JSON de
  // POST/PUT /exercises (arbitrage du 2026-09-01, "Bloc image de premier
  // niveau pour l'Exercice"). Volontairement sous le défaut NON déclaré de
  // nginx-global (1 Mio) — voir exercise.constants.ts pour le détail du
  // budget. Sans effet sur les routes multipart (FileInterceptor/multer
  // gère son propre flux, jamais parsé par json()/urlencoded()).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: EXERCISE_JSON_BODY_MAX_BYTES }));
  app.use(urlencoded({ extended: true, limit: EXERCISE_JSON_BODY_MAX_BYTES }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Content Catalog Service')
    .setDescription('Catalogue des ressources pédagogiques VisioMath — exercices, évaluations et tutoriels-vidéos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[content-catalog-service] listening on port ${port}`);
}
bootstrap();

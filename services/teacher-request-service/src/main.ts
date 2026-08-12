import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createValidationPipe());
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Teacher Request Service')
    .setDescription('Manage student-to-teacher session requests for VisioMath')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      name: 'x-correlation-id',
      in: 'header',
      required: false,
      description: 'Correlation propagee par la gateway ; generee si absente et renvoyee en reponse.',
      schema: { type: 'string' },
    })
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[teacher-request-service] listening on port ${port}`);
}
bootstrap();

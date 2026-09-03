import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TutorialsController } from './tutorials.controller';
import { TutorialsService } from './tutorials.service';
import { Tutorial } from './entities/tutorial.entity';
import { TutorialBlock } from './entities/tutorial-block.entity';
import { Quiz } from '../quizzes/entities/quiz.entity';
import { ExercisesModule } from '../exercises/exercises.module';
import { ProfileClientModule } from '../common/clients/profile-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tutorial, TutorialBlock, Quiz]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    // Réutilise ExerciseImageStorageService/ExerciseImageTranscoder pour les
    // blocs image (mêmes classes, mêmes volume/transcodeur — arbitrage du
    // 2026-09-03, "Refonte des Tutos/Vidéos", point 4), plutôt que d'en
    // écrire un second.
    ExercisesModule,
    ProfileClientModule,
  ],
  controllers: [TutorialsController],
  providers: [TutorialsService],
  exports: [TutorialsService],
})
export class TutorialsModule {}

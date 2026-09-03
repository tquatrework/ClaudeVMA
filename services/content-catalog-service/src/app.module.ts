import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExercisesModule } from './exercises/exercises.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { TutorialsModule } from './tutorials/tutorials.module';
import { ContentsModule } from './contents/contents.module';
import { ValidationsModule } from './validations/validations.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { HealthModule } from './health/health.module';
import { Exercise } from './exercises/entities/exercise.entity';
import { ExercisePart } from './exercises/entities/exercise-part.entity';
import { ExerciseSolution } from './exercises/entities/exercise-solution.entity';
import { ExerciseContentItem } from './exercises/entities/exercise-content-item.entity';
import { Evaluation } from './evaluations/entities/evaluation.entity';
import { Tutorial } from './tutorials/entities/tutorial.entity';
import { TutorialBlock } from './tutorials/entities/tutorial-block.entity';
import { ContentComment } from './contents/entities/content-comment.entity';
import { ContentRating } from './contents/entities/content-rating.entity';
import { ContentValidation } from './validations/entities/content-validation.entity';
import { Quiz } from './quizzes/entities/quiz.entity';
import { QuizQuestion } from './quizzes/entities/quiz-question.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          Exercise,
          ExercisePart,
          ExerciseSolution,
          ExerciseContentItem,
          Evaluation,
          Tutorial,
          TutorialBlock,
          ContentComment,
          ContentRating,
          ContentValidation,
          Quiz,
          QuizQuestion,
        ],
        // Migrations réelles depuis l'incident de production du 2026-08-29
        // (colonnes NOT NULL ajoutées par la refonte des Exercices sur des
        // tables contenant encore des lignes du modèle pré-refonte) —
        // synchronize reste réservé aux environnements non-production,
        // migrationsRun s'exécute au boot en dehors des tests. Même modèle
        // que pedagogical-log-service.
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: configService.get<string>('NODE_ENV') !== 'test',
      }),
      inject: [ConfigService],
    }),
    ExercisesModule,
    EvaluationsModule,
    TutorialsModule,
    ContentsModule,
    ValidationsModule,
    QuizzesModule,
    HealthModule,
  ],
})
export class AppModule {}

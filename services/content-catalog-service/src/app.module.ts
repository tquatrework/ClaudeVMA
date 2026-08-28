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
import { ExerciseAnswer } from './exercises/entities/exercise-answer.entity';
import { ExerciseCorrection } from './exercises/entities/exercise-correction.entity';
import { ExerciseSolution } from './exercises/entities/exercise-solution.entity';
import { Evaluation } from './evaluations/entities/evaluation.entity';
import { EvaluationAttempt } from './evaluations/entities/evaluation-attempt.entity';
import { Tutorial } from './tutorials/entities/tutorial.entity';
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
          ExerciseAnswer,
          ExerciseCorrection,
          ExerciseSolution,
          Evaluation,
          EvaluationAttempt,
          Tutorial,
          ContentComment,
          ContentRating,
          ContentValidation,
          Quiz,
          QuizQuestion,
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
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

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenActivitiesModule } from './open-activities/open-activities.module';
import { ActivitiesModule } from './activities/activities.module';
import { QuizAttemptsModule } from './quiz-attempts/quiz-attempts.module';
import { ExerciseAttemptsModule } from './exercise-attempts/exercise-attempts.module';
import { EvaluationAttemptsModule } from './evaluation-attempts/evaluation-attempts.module';
import { HealthModule } from './health/health.module';
import { OpenActivity } from './open-activities/entities/open-activity.entity';
import { ActivityAcceptance } from './open-activities/entities/activity-acceptance.entity';
import { QuizAttempt } from './quiz-attempts/entities/quiz-attempt.entity';
import { ExerciseAttempt } from './exercise-attempts/entities/exercise-attempt.entity';
import { ExerciseAttemptPart } from './exercise-attempts/entities/exercise-attempt-part.entity';
import { EvaluationAttempt } from './evaluation-attempts/entities/evaluation-attempt.entity';
import { EvaluationCorrectionRequest } from './evaluation-attempts/entities/evaluation-correction-request.entity';
import { DomainEvent } from './evaluation-attempts/entities/domain-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          OpenActivity,
          ActivityAcceptance,
          QuizAttempt,
          ExerciseAttempt,
          ExerciseAttemptPart,
          EvaluationAttempt,
          EvaluationCorrectionRequest,
          DomainEvent,
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    OpenActivitiesModule,
    ActivitiesModule,
    QuizAttemptsModule,
    ExerciseAttemptsModule,
    EvaluationAttemptsModule,
    HealthModule,
  ],
})
export class AppModule {}

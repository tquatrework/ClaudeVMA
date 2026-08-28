import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenActivitiesModule } from './open-activities/open-activities.module';
import { ActivitiesModule } from './activities/activities.module';
import { QuizAttemptsModule } from './quiz-attempts/quiz-attempts.module';
import { HealthModule } from './health/health.module';
import { OpenActivity } from './open-activities/entities/open-activity.entity';
import { ActivityAcceptance } from './open-activities/entities/activity-acceptance.entity';
import { QuizAttempt } from './quiz-attempts/entities/quiz-attempt.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [OpenActivity, ActivityAcceptance, QuizAttempt],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    OpenActivitiesModule,
    ActivitiesModule,
    QuizAttemptsModule,
    HealthModule,
  ],
})
export class AppModule {}

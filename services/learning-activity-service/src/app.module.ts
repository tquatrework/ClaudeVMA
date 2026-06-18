import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenActivitiesModule } from './open-activities/open-activities.module';
import { ActivitiesModule } from './activities/activities.module';
import { HealthModule } from './health/health.module';
import { OpenActivity } from './open-activities/entities/open-activity.entity';
import { ActivityAcceptance } from './open-activities/entities/activity-acceptance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [OpenActivity, ActivityAcceptance],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    OpenActivitiesModule,
    ActivitiesModule,
    HealthModule,
  ],
})
export class AppModule {}

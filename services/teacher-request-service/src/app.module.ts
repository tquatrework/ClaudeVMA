import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TeacherRequestModule } from './teacher-request/teacher-request.module';
import { HealthModule } from './health/health.module';
import { TeacherRequest } from './teacher-request/entities/teacher-request.entity';
import { TeacherProposal } from './teacher-request/entities/teacher-proposal.entity';
import { Assignment } from './teacher-request/entities/assignment.entity';
import { TerminationRequest } from './teacher-request/entities/termination-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [TeacherRequest, TeacherProposal, Assignment, TerminationRequest],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TeacherRequestModule,
    HealthModule,
  ],
})
export class AppModule {}

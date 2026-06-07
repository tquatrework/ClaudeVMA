import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TeacherRequest } from './entities/teacher-request.entity';
import { TeacherProposal } from './entities/teacher-proposal.entity';
import { Assignment } from './entities/assignment.entity';
import { TerminationRequest } from './entities/termination-request.entity';
import { TeacherRequestController } from './teacher-request.controller';
import { TeacherRequestService } from './teacher-request.service';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../common/jwt.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherRequest, TeacherProposal, Assignment, TerminationRequest]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TeacherRequestController],
  providers: [TeacherRequestService, EventsService, JwtAuthGuard],
})
export class TeacherRequestModule {}

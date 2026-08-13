import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeacherRequest } from './entities/teacher-request.entity';
import { TeacherProposal } from './entities/teacher-proposal.entity';
import { Assignment } from './entities/assignment.entity';
import { TeacherRequestController } from './teacher-request.controller';
import { RequestProposalsController } from './request-proposals.controller';
import { ProposalController } from './proposal.controller';
import { AssignmentController } from './assignment.controller';
import { TeacherRequestService } from './teacher-request.service';
import { ProfileServiceClient } from './clients/profile-service.client';
import { SecurityModule } from '../security/security.module';
import { EventsModule } from '../events/events.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { CorrelationIdMiddleware } from '../common/correlation-id.middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherRequest, TeacherProposal, Assignment]),
    SecurityModule,
    EventsModule,
    IdempotencyModule,
  ],
  controllers: [
    TeacherRequestController,
    RequestProposalsController,
    ProposalController,
    AssignmentController,
  ],
  providers: [TeacherRequestService, ProfileServiceClient],
})
export class TeacherRequestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

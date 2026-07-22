import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeacherRequest } from './entities/teacher-request.entity';
import { TeacherProposal } from './entities/teacher-proposal.entity';
import { Assignment } from './entities/assignment.entity';
import { TerminationRequest } from './entities/termination-request.entity';
import { TeacherRequestController } from './teacher-request.controller';
import { ProposalController } from './proposal.controller';
import { AssignmentController } from './assignment.controller';
import { CollaborationController } from './collaboration.controller';
import { TeacherRequestService } from './teacher-request.service';
import { EventsService } from './events.service';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherRequest, TeacherProposal, Assignment, TerminationRequest]),
    SecurityModule,
  ],
  controllers: [TeacherRequestController, ProposalController, AssignmentController, CollaborationController],
  providers: [TeacherRequestService, EventsService],
})
export class TeacherRequestModule {}

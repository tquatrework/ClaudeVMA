import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { EvaluationAttemptsController } from './evaluation-attempts.controller';
import { EvaluationAttemptsService } from './evaluation-attempts.service';
import { EvaluationCorrectionsController } from './evaluation-corrections.controller';
import { EvaluationCorrectionsService } from './evaluation-corrections.service';
import { EvaluationStructureClientService } from './evaluation-structure-client.service';
import { ProfileRelationsClientService } from './profile-relations-client.service';
import { EventsService } from './events/events.service';
import { EventPublisherService } from './events/event-publisher.service';
import { EvaluationAttempt } from './entities/evaluation-attempt.entity';
import { EvaluationCorrectionRequest } from './entities/evaluation-correction-request.entity';
import { DomainEvent } from './entities/domain-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EvaluationAttempt, EvaluationCorrectionRequest, DomainEvent]),
    JwtModule.register({}),
  ],
  controllers: [EvaluationAttemptsController, EvaluationCorrectionsController],
  providers: [
    EvaluationAttemptsService,
    EvaluationCorrectionsService,
    EvaluationStructureClientService,
    ProfileRelationsClientService,
    EventsService,
    EventPublisherService,
  ],
  exports: [EvaluationAttemptsService, EvaluationCorrectionsService],
})
export class EvaluationAttemptsModule {}

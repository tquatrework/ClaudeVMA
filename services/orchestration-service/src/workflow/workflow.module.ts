import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { CompensationAction } from './entities/compensation-action.entity';
import { RetryPolicy } from './entities/retry-policy.entity';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowPayloadValidatorService } from './workflow-payload-validator.service';
import { WorkflowController } from './workflow.controller';
import { HttpClientModule } from '../http-client/http-client.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { EventModule } from '../event/event.module';
import { CorrelationTraceModule } from '../correlation/correlation-trace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowInstance, WorkflowStep, CompensationAction, RetryPolicy]),
    HttpClientModule,
    IdempotencyModule,
    EventModule,
    CorrelationTraceModule,
  ],
  providers: [WorkflowEngineService, WorkflowPayloadValidatorService],
  controllers: [WorkflowController],
})
export class WorkflowModule {}

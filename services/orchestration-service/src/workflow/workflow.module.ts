import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowController } from './workflow.controller';
import { HttpClientModule } from '../http-client/http-client.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowInstance, WorkflowStep]),
    HttpClientModule,
    IdempotencyModule,
  ],
  providers: [WorkflowEngineService],
  controllers: [WorkflowController],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}

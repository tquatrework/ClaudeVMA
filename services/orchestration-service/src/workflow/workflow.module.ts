import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { CompensationAction } from './entities/compensation-action.entity';
import { RetryPolicy } from './entities/retry-policy.entity';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowController } from './workflow.controller';
import { HttpClientModule } from '../http-client/http-client.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { EventModule } from '../event/event.module';
import { CorrelationTraceModule } from '../correlation/correlation-trace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowInstance, WorkflowStep, CompensationAction, RetryPolicy]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
      inject: [ConfigService],
    }),
    HttpClientModule,
    IdempotencyModule,
    EventModule,
    CorrelationTraceModule,
  ],
  providers: [WorkflowEngineService],
  controllers: [WorkflowController],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}

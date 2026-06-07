import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowController } from './workflow.controller';
import { HttpClientModule } from '../http-client/http-client.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowInstance, WorkflowStep]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
      inject: [ConfigService],
    }),
    HttpClientModule,
    IdempotencyModule,
  ],
  providers: [WorkflowEngineService],
  controllers: [WorkflowController],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}

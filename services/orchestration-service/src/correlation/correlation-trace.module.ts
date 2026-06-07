import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrelationTrace } from './entities/correlation-trace.entity';
import { CorrelationTraceService } from './correlation-trace.service';

@Module({
  imports: [TypeOrmModule.forFeature([CorrelationTrace])],
  providers: [CorrelationTraceService],
  exports: [CorrelationTraceService],
})
export class CorrelationTraceModule {}

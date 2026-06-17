import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { TeacherPaymentRequestsController } from './teacher-payment-requests.controller';
import { TeacherPaymentRequestsService } from './teacher-payment-requests.service';
import { TeacherPaymentRequest } from './entities/teacher-payment-request.entity';
import { FinancialPointLedger } from '../payments/entities/financial-point-ledger.entity';
import { FinancialArchiveItem } from '../financial-archives/entities/financial-archive-item.entity';
import { FinancialProfilesModule } from '../financial-profiles/financial-profiles.module';
import { EventsModule } from '../events/events.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherPaymentRequest, FinancialPointLedger, FinancialArchiveItem]),
    JwtModule.register({}),
    FinancialProfilesModule,
    EventsModule,
  ],
  controllers: [TeacherPaymentRequestsController],
  providers: [TeacherPaymentRequestsService, JwtAuthGuard, RolesGuard],
  exports: [TeacherPaymentRequestsService],
})
export class TeacherPaymentRequestsModule {}

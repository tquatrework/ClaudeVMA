import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { Invoice } from './entities/invoice.entity';
import { FinancialPointLedger } from './entities/financial-point-ledger.entity';
import { FinancialArchiveItem } from '../financial-archives/entities/financial-archive-item.entity';
import { FinancialProfilesModule } from '../financial-profiles/financial-profiles.module';
import { EventsModule } from '../events/events.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Invoice, FinancialPointLedger, FinancialArchiveItem]),
    JwtModule.register({}),
    FinancialProfilesModule,
    EventsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, JwtAuthGuard, RolesGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}

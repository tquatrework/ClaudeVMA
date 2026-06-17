import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import {
  FinancialSettingsController,
  FinanceEventsController,
} from './financial-settings.controller';
import { FinancialSettingsService } from './financial-settings.service';
import { RewardSetting } from './entities/reward-setting.entity';
import { FinancialArchiveItem } from '../financial-archives/entities/financial-archive-item.entity';
import { FinancialPointLedger } from '../payments/entities/financial-point-ledger.entity';
import { Payment } from '../payments/entities/payment.entity';
import { EventsModule } from '../events/events.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RewardSetting,
      FinancialArchiveItem,
      FinancialPointLedger,
      Payment,
    ]),
    JwtModule.register({}),
    EventsModule,
  ],
  controllers: [FinancialSettingsController, FinanceEventsController],
  providers: [FinancialSettingsService, JwtAuthGuard, RolesGuard],
  exports: [FinancialSettingsService],
})
export class FinancialSettingsModule {}

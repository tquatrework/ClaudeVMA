import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FinancialProfilesModule } from './financial-profiles/financial-profiles.module';
import { PaymentsModule } from './payments/payments.module';
import { FinancialArchivesModule } from './financial-archives/financial-archives.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { EventsModule } from './events/events.module';
import { FinancialProfile } from './financial-profiles/entities/financial-profile.entity';
import { Payment } from './payments/entities/payment.entity';
import { Invoice } from './payments/entities/invoice.entity';
import { FinancialPointLedger } from './payments/entities/financial-point-ledger.entity';
import { FinancialArchiveItem } from './financial-archives/entities/financial-archive-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          FinancialProfile,
          Payment,
          Invoice,
          FinancialPointLedger,
          FinancialArchiveItem,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    EventsModule,
    FinancialProfilesModule,
    PaymentsModule,
    FinancialArchivesModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}

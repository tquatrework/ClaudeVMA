import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { ConsentsModule } from './consents/consents.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { User } from './auth/entities/user.entity';
import { LoginSession } from './auth/entities/login-session.entity';
import { AuditLog } from './accounts/entities/audit-log.entity';
import { ConsentRecord } from './consents/entities/consent-record.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [User, LoginSession, AuditLog, ConsentRecord],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AccountsModule,
    ConsentsModule,
    EventsModule,
    HealthModule,
  ],
})
export class AppModule {}

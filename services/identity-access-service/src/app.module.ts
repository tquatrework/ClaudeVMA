import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { ConsentsModule } from './consents/consents.module';
import { DelegationsModule } from './delegations/delegations.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { User } from './auth/entities/user.entity';
import { LoginSession } from './auth/entities/login-session.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from './auth/entities/email-verification-token.entity';
import { IdentifierRecoveryToken } from './auth/entities/identifier-recovery-token.entity';
import { AuditLog } from './accounts/entities/audit-log.entity';
import { ConsentRecord } from './consents/entities/consent-record.entity';
import { DelegatedAccessRequest } from './delegations/entities/delegated-access-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [User, LoginSession, PasswordResetToken, EmailVerificationToken, IdentifierRecoveryToken, AuditLog, ConsentRecord, DelegatedAccessRequest],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AccountsModule,
    ConsentsModule,
    DelegationsModule,
    EventsModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}

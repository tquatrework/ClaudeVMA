import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './auth/entities/user.entity';
import { LoginSession } from './auth/entities/login-session.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';
import { AuditLog } from './accounts/entities/audit-log.entity';
import { ConsentRecord } from './consents/entities/consent-record.entity';
import { DelegatedAccessRequest } from './delegations/entities/delegated-access-request.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    LoginSession,
    PasswordResetToken,
    AuditLog,
    ConsentRecord,
    DelegatedAccessRequest,
  ],
  migrations: ['dist/src/migrations/*.js'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

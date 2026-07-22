import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LoginSession } from './entities/login-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { IdentifierRecoveryToken } from './entities/identifier-recovery-token.entity';
import { EventsModule } from '../events/events.module';
import { MailModule } from '../mail/mail.module';
import { AccountsModule } from '../accounts/accounts.module';

// Note : `User` est possédé par AccountsModule (modules-convention — une entité n'est
// enregistrée que dans le module qui la possède). AuthModule ne fait plus de
// TypeOrmModule.forFeature([User]) ni d'InjectRepository(User) ; il consomme
// AccountsService pour toute lecture/écriture sur le compte.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoginSession,
      PasswordResetToken,
      EmailVerificationToken,
      IdentifierRecoveryToken,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
      inject: [ConfigService],
    }),
    EventsModule,
    MailModule,
    AccountsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // AuthService et JwtModule n'ont pas de consommateur externe réel (JwtStrategy
  // vit dans ce même module et s'enregistre auprès de Passport) : rien n'est exporté.
})
export class AuthModule {}

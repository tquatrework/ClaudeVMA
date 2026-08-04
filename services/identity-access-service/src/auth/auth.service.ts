import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { User } from './entities/user.entity';
import { LoginSession } from './entities/login-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { IdentifierRecoveryToken } from './entities/identifier-recovery-token.entity';
import { LoginDto } from './dto/login.dto';
import { EventsService } from '../events/events.service';
import { MailService } from '../mail/mail.service';
import { AccountsService } from '../accounts/accounts.service';

interface JwtPayload {
  sub: string;
  loginIdentifier: string;
  email: string;
  role: string;
  validationStatus: string;
  jti: string;
  type: 'access' | 'refresh';
}

/**
 * Génère un token URL-safe aléatoire de 48 octets (64 caractères hex).
 * Utilisé pour tous les tokens envoyés par email.
 */
function generateSecureToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Produit un hash SHA-256 du token brut.
 * Seul le hash est stocké en base — le token brut est envoyé par email uniquement.
 */
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(LoginSession) private readonly sessionRepo: Repository<LoginSession>,
    @InjectRepository(PasswordResetToken) private readonly resetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(EmailVerificationToken) private readonly emailVerifTokenRepo: Repository<EmailVerificationToken>,
    @InjectRepository(IdentifierRecoveryToken) private readonly identifierRecoveryTokenRepo: Repository<IdentifierRecoveryToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
    private readonly mailService: MailService,
    private readonly accountsService: AccountsService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.accountsService.findCredentialsByLoginIdentifier(dto.loginIdentifier);

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    return this.buildTokenResponse(user, ipAddress, userAgent);
  }

  async logout(jti: string): Promise<void> {
    await this.sessionRepo.update({ jwtId: jti }, { revokedAt: new Date() });
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const session = await this.sessionRepo.findOne({ where: { jwtId: payload.jti } });
    if (!session || session.revokedAt || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const user = await this.accountsService.findActiveAccountById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();

    await this.sessionRepo.update(session.id, { revokedAt: new Date() });

    return this.buildTokenResponse(user);
  }

  // ─── Email verification ───────────────────────────────────────────────────

  /**
   * Demande l'envoi d'un email de vérification d'adresse.
   * Réponse neutre pour éviter l'énumération d'adresses.
   */
  async sendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.accountsService.findAccountByEmail(email);

    if (user && !user.emailVerified) {
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const ttlMinutes = this.configService.get<number>('EMAIL_VERIFICATION_TOKEN_TTL_MINUTES', 1440);
      const expiresAt = addMinutes(new Date(), ttlMinutes);

      await this.emailVerifTokenRepo.save(
        this.emailVerifTokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
      );

      await this.mailService.sendEmailVerification(user.email, user.firstName, rawToken);

      this.logger.log(`Email de vérification envoyé pour l'utilisateur ${user.id}`);
    }

    return { message: 'Si un compte non vérifié existe pour cette adresse, un email de vérification a été envoyé.' };
  }

  /**
   * Confirme la vérification d'email via le token reçu.
   * Marque le compte comme email_verified = true et invalide le token.
   */
  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenHash = hashToken(rawToken);

    const verificationRecord = await this.emailVerifTokenRepo.findOne({
      where: { tokenHash },
    });

    if (!verificationRecord || verificationRecord.usedAt || new Date() > verificationRecord.expiresAt) {
      throw new BadRequestException('Token de vérification invalide ou expiré.');
    }

    // Invalider le token (usage unique)
    await this.emailVerifTokenRepo.update(verificationRecord.id, { usedAt: new Date() });

    // Marquer l'email comme vérifié
    await this.accountsService.markEmailVerified(verificationRecord.userId);

    this.eventsService.publish('EmailVerified', {
      userId: verificationRecord.userId,
    });

    this.logger.log(`Email vérifié pour l'utilisateur ${verificationRecord.userId}`);

    return { message: 'Adresse email vérifiée avec succès.' };
  }

  // ─── Identifier recovery ──────────────────────────────────────────────────

  /**
   * Récupère l'identifiant de connexion associé à une adresse email.
   * Envoie directement l'email avec l'identifiant (pas de token de confirmation nécessaire).
   * Réponse neutre pour éviter l'énumération d'adresses.
   */
  async recoverIdentifier(email: string, ipAddress?: string): Promise<{ message: string }> {
    const matchingUsers = await this.accountsService.findAccountsByEmail(email);

    if (matchingUsers.length > 0) {
      const loginIdentifiers = matchingUsers.map((user) => user.loginIdentifier);

      // Trace de la demande (audit)
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const ttlMinutes = this.configService.get<number>('RECOVER_IDENTIFIER_TOKEN_TTL_MINUTES', 60);
      const expiresAt = addMinutes(new Date(), ttlMinutes);

      await this.identifierRecoveryTokenRepo.save(
        this.identifierRecoveryTokenRepo.create({ email, tokenHash, expiresAt }),
      );

      await this.mailService.sendIdentifierRecovery(email, loginIdentifiers);

      this.eventsService.publish('IdentifierRecoveryRequested', {
        email,
        loginIdentifiersCount: loginIdentifiers.length,
        ipAddress,
      });

      this.logger.log(`Récupération d'identifiant pour ${matchingUsers.length} compte(s) — email: masqué`);
    }

    return { message: 'Si cette adresse email est enregistrée, le ou les identifiant(s) de connexion ont été envoyés.' };
  }

  // ─── Password reset ────────────────────────────────────────────────────────

  /**
   * Initie une réinitialisation de mot de passe via loginIdentifier.
   * Réponse neutre pour éviter l'énumération d'identifiants.
   */
  async requestPasswordReset(loginIdentifier: string, ipAddress?: string): Promise<{ message: string }> {
    const user = await this.accountsService.findAccountByLoginIdentifier(loginIdentifier);

    if (user) {
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const ttlMinutes = this.configService.get<number>('PASSWORD_RESET_TOKEN_TTL_MINUTES', 60);
      const expiresAt = addMinutes(new Date(), ttlMinutes);

      await this.resetTokenRepo.save(
        this.resetTokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
      );

      await this.mailService.sendPasswordReset(user.email, user.firstName, rawToken);

      this.eventsService.publish('PasswordResetRequested', {
        userId: user.id,
        ipAddress,
      });

      this.logger.log(`Réinitialisation de mot de passe demandée pour l'utilisateur ${user.id}`);
    }

    return { message: 'Si cet identifiant est enregistré, un lien de réinitialisation a été envoyé à l\'adresse email associée.' };
  }

  /**
   * Confirme la réinitialisation de mot de passe via le token reçu par email.
   * Le token est invalidé après usage unique.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = hashToken(rawToken);

    const resetRecord = await this.resetTokenRepo.findOne({ where: { tokenHash } });

    if (!resetRecord || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Token de réinitialisation invalide ou expiré.');
    }

    // Invalider le token (usage unique)
    await this.resetTokenRepo.update(resetRecord.id, { usedAt: new Date() });

    // Révoquer toutes les sessions actives (sécurité)
    await this.sessionRepo.update({ userId: resetRecord.userId }, { revokedAt: new Date() });

    // Mettre à jour le mot de passe
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.accountsService.updatePasswordHash(resetRecord.userId, newPasswordHash);

    this.eventsService.publish('PasswordReset', {
      userId: resetRecord.userId,
    });

    this.logger.log(`Mot de passe réinitialisé pour l'utilisateur ${resetRecord.userId}`);

    return { message: 'Mot de passe réinitialisé avec succès. Veuillez vous reconnecter.' };
  }

  // ─── Token builder ────────────────────────────────────────────────────────

  async buildTokenResponse(user: User, ipAddress?: string, userAgent?: string) {
    const jti = randomUUID();

    const accessPayload = {
      sub: user.id,
      loginIdentifier: user.loginIdentifier,
      email: user.email,
      role: user.role,
      validationStatus: user.validationStatus,
      jti,
      type: 'access',
    };
    const refreshPayload = { sub: user.id, jti, type: 'refresh' };

    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: '7d' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionRepo.save(
      this.sessionRepo.create({ userId: user.id, jwtId: jti, ipAddress, userAgent, expiresAt }),
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        loginIdentifier: user.loginIdentifier,
        email: user.email,
        role: user.role,
        validationStatus: user.validationStatus,
        emailVerified: user.emailVerified,
      },
    };
  }
}

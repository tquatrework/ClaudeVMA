import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User } from './entities/user.entity';
import { LoginSession } from './entities/login-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { LoginDto } from './dto/login.dto';
import { EventsService } from '../events/events.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  validationStatus: string;
  jti: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(LoginSession) private readonly sessionRepo: Repository<LoginSession>,
    @InjectRepository(PasswordResetToken) private readonly resetTokenRepo: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly eventsService: EventsService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

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

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    await this.sessionRepo.update(session.id, { revokedAt: new Date() });

    return this.buildTokenResponse(user);
  }

  /**
   * Initiates a password reset flow.
   * Always returns a success response to avoid email enumeration.
   * In production a real email would be sent; here we log the token for observability.
   */
  async requestPasswordReset(email: string, ipAddress?: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { email } });

    if (user) {
      const rawToken = randomUUID();
      const tokenHash = await bcrypt.hash(rawToken, 10);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      await this.resetTokenRepo.save(
        this.resetTokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
      );

      this.eventsService.publish('PasswordResetRequested', {
        userId: user.id,
        email: user.email,
        ipAddress,
        // In production, rawToken would be emailed to the user — never logged in plaintext.
      });

      // Phase 1 stub: log that a reset was triggered (token not exposed in logs)
      this.logger.log(`Password reset requested for user ${user.id}`);
    }

    // Always return success to prevent email enumeration
    return { message: 'If the email is registered, a reset link will be sent.' };
  }

  /**
   * TI-only: regenerates access for a blocked account by resetting isActive and clearing sessions.
   * All existing sessions are revoked and a new temporary token pair is issued.
   */
  async regenerateAccess(targetUserId: string, actor: User): Promise<{ message: string }> {
    const targetUser = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!targetUser) throw new UnauthorizedException(`Account ${targetUserId} not found`);

    // Revoke all active sessions
    await this.sessionRepo.update(
      { userId: targetUserId },
      { revokedAt: new Date() },
    );

    // Reactivate the account
    targetUser.isActive = true;
    await this.userRepo.save(targetUser);

    this.eventsService.publish('AccessRegenerated', {
      targetUserId,
      actorId: actor.id,
    });

    return { message: `Access regenerated for account ${targetUserId}. All prior sessions revoked.` };
  }

  async buildTokenResponse(user: User, ipAddress?: string, userAgent?: string) {
    const jti = randomUUID();

    const accessPayload = {
      sub: user.id,
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
        email: user.email,
        role: user.role,
        validationStatus: user.validationStatus,
      },
    };
  }
}

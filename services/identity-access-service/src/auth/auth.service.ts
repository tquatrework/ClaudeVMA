import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User } from './entities/user.entity';
import { LoginSession } from './entities/login-session.entity';
import { LoginDto } from './dto/login.dto';

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
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(LoginSession) private readonly sessionRepo: Repository<LoginSession>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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

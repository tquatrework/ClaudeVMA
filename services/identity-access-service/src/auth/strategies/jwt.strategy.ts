import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../../accounts/accounts.service';

interface JwtPayload {
  sub: string;
  loginIdentifier: string;
  email: string;
  role: string;
  validationStatus: string;
  jti: string;
  type: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly accountsService: AccountsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');

    // User est possédé par AccountsModule (modules-convention) : on consomme
    // AccountsService plutôt que d'injecter directement le repository.
    const user = await this.accountsService.findActiveAccountById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();

    return { ...user, jti: payload.jti };
  }
}

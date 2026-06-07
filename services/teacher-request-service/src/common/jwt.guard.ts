import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface RawJwtPayload {
  sub: string;
  email: string;
  role: string;
  validationStatus: string;
  jti: string;
  type: string;
}

export interface JwtPayload {
  id: string;
  role: string;
  email?: string;
  validationStatus?: string;
  jti?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth: string | undefined = request.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const token = auth.slice(7);
      const secret = this.config.get<string>('JWT_SECRET', 'dev-secret');
      const raw = this.jwtService.verify<RawJwtPayload>(token, { secret });
      if (raw.type !== 'access') throw new UnauthorizedException('Invalid token type');
      request.user = {
        id: raw.sub,
        email: raw.email,
        role: raw.role,
        validationStatus: raw.validationStatus,
        jti: raw.jti,
      } satisfies JwtPayload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

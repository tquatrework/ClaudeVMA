import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  loginIdentifier: string;
  email: string;
  role: string;
  validationStatus: string;
  jti: string;
  type: string;
}

/**
 * Guard that manually verifies the Bearer JWT using @nestjs/jwt.
 * The signing secret is configured once, in SecurityModule (JwtModule.registerAsync),
 * so this guard does not read configuration itself.
 * The decoded payload is attached to request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: payload.sub,
      loginIdentifier: payload.loginIdentifier,
      email: payload.email,
      role: payload.role as UserRole,
      validationStatus: payload.validationStatus,
      jti: payload.jti,
    };
    request.user = authenticatedUser;

    return true;
  }
}

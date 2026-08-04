import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // Presence of INTERNAL_SECRET is guaranteed at boot by env validation
    // (see src/config/env.validation.ts) — getOrThrow only guards against
    // programming errors, not a legitimately empty secret.
    const expectedSecret = this.config.getOrThrow<string>('INTERNAL_SECRET');
    const request = context.switchToHttp().getRequest();
    const providedSecret = request.headers['x-internal-secret'];
    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Internal access only');
    }
    return true;
  }
}

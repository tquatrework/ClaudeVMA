import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that validates the X-Internal-Secret header.
 * Used to protect routes exposed only to the orchestration-service.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    const expected = this.config.get<string>('INTERNAL_SECRET');

    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing X-Internal-Secret header');
    }
    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for internal inter-service routes.
 * Validates the X-Internal-Secret header against INTERNAL_SECRET env var.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const internalSecret = request.headers['x-internal-secret'];
    const expectedSecret = this.config.get<string>('INTERNAL_SECRET');

    if (!internalSecret || internalSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing X-Internal-Secret header');
    }

    return true;
  }
}

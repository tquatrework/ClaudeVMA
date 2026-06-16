import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for internal inter-service routes.
 * Validates the X-Internal-Secret header against the INTERNAL_SECRET env variable.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedSecret: string | undefined = request.headers['x-internal-secret'];
    const expectedSecret = this.config.get<string>('INTERNAL_SECRET');

    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing X-Internal-Secret header');
    }

    return true;
  }
}

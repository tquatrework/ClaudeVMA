import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Restricts a controller to internal callers (e.g. orchestration-service)
 * presenting the shared `X-Internal-Secret` header.
 * Keeps authorization logic out of the controller body (controllers-convention).
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedSecret: string | undefined = request.headers['x-internal-secret'];
    const expectedSecret = this.config.getOrThrow<string>('INTERNAL_SECRET');

    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid internal secret');
    }

    return true;
  }
}

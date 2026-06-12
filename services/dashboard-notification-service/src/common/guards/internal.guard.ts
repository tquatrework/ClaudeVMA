import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalGuard implements CanActivate {
  private readonly logger = new Logger(InternalGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_SECRET');
    if (!expected) {
      this.logger.error('INTERNAL_SECRET not configured — rejecting all internal requests');
      throw new UnauthorizedException('Internal access only');
    }
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-secret'];
    if (provided !== expected) {
      throw new UnauthorizedException('Internal access only');
    }
    return true;
  }
}

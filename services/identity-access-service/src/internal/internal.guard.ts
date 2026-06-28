import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InternalGuard implements CanActivate {
  private readonly logger = new Logger(InternalGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("INTERNAL_SECRET");
    if (!expected) {
      this.logger.error("INTERNAL_SECRET is not configured — denying all internal requests (S3)");
      throw new UnauthorizedException("Internal endpoints are disabled: INTERNAL_SECRET not configured");
    }
    const request = context.switchToHttp().getRequest();
    const provided = request.headers["x-internal-secret"];
    if (provided !== expected) {
      throw new UnauthorizedException("Internal access only");
    }
    return true;
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Extracts the authenticated actor set on the request by JwtAuthGuard.
 * Controllers must use `@CurrentUser() actor: AuthenticatedUser` instead of
 * `@Request() req` + `req.user: any` (controllers-convention).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

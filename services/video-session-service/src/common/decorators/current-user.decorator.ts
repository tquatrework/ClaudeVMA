import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../guards/jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): JwtPayload => {
    return executionContext.switchToHttp().getRequest().user;
  },
);

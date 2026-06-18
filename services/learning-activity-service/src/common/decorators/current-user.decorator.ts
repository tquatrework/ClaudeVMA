import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../guards/jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): AuthenticatedUser => {
    return executionContext.switchToHttp().getRequest().user;
  },
);

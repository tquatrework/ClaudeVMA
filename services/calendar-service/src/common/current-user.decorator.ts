import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): AuthenticatedUser => {
    return executionContext.switchToHttp().getRequest().user;
  },
);

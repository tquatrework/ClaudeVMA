import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  loginIdentifier: string;
  email: string;
  role: string;
  validationStatus: string;
  jti: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): AuthUser => {
    const request = executionContext.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);

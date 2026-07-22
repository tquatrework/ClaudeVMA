import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the `x-correlation-id` header once, transversally, instead of
 * repeating `@Headers('x-correlation-id') correlationId?: string` on every
 * controller method (controllers-convention: "Le correlation ID est géré
 * transversalement, pas par des headers inutilisés répétés dans les
 * méthodes").
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): string | undefined => {
    const request = executionContext.switchToHttp().getRequest();
    return request.headers['x-correlation-id'];
  },
);

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

/**
 * Guard webhook : valide le header X-Webhook-Secret contre la variable d'env WEBHOOK_SECRET.
 * Ne pas remplacer par JWT — les providers externes n'ont pas de JWT utilisateur.
 * Comportement fail-closed : si WEBHOOK_SECRET n'est pas définie, tout accès est refusé.
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret: string | undefined = request.headers['x-webhook-secret'];
    const expected: string | undefined = process.env.WEBHOOK_SECRET;

    if (!expected) return false; // fail-closed si var absente
    return secret === expected;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface InternalAccountSummary {
  userId: string;
  loginIdentifier: string;
  role: string;
  email: string;
}

/**
 * Thin client for the internal routes of identity-access-service, the sole
 * owner of the role (docs/architecture.md > "Propriete du role").
 *
 * Built to resolve a role broadcast into a real per-user fan-out: a
 * notification targeting `targetRole` used to be stored as a single row
 * with a synthetic `userId = "role:<role>"` that never matches a real
 * account and is therefore invisible to `GET /notifications` (filtered by
 * the caller's real `userId`). Confirmed against the deployed stack
 * 2026-08-17: `GET /internal/accounts?role=...` already exists on
 * identity-access-service and returns exactly the userIds needed — no new
 * route required.
 *
 * Same technical choices as `ProfileServiceClient` (platform `fetch`, no
 * new HTTP dependency; throws on failure instead of degrading silently —
 * a failed resolution must never turn into "no one notified").
 */
@Injectable()
export class IdentityAccessServiceClient {
  private readonly logger = new Logger(IdentityAccessServiceClient.name);
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  private readonly requestTimeoutMs = 5000;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>('IDENTITY_ACCESS_SERVICE_URL');
    this.internalSecret = this.config.getOrThrow<string>('INTERNAL_SECRET');
  }

  /**
   * List the userIds of every account currently holding `role`, via
   * `GET /internal/accounts?role=...`. An unknown or empty role simply
   * resolves to an empty list — the caller decides what an empty fan-out
   * means for its own use case (typically: no notification is created).
   */
  async listUserIdsByRole(role: string): Promise<string[]> {
    const accounts = await this.request<InternalAccountSummary[]>(
      'GET',
      `/internal/accounts?role=${encodeURIComponent(role)}`,
    );
    return accounts.map((account) => account.userId);
  }

  private async request<T>(method: 'GET', path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`identity-access-service ${method} ${path} responded with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(`Call to identity-access-service failed (${method} ${path}): ${(error as Error).message}`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DisplayName {
  firstName: string | null;
  lastName: string | null;
}

/**
 * Thin client for the internal routes of profile-service consumed by the
 * Redis event processor. Deliberately built on the platform's global
 * `fetch` (Node 20) rather than adding an HTTP client dependency
 * (`axios`/`@nestjs/axios`) — two narrow read-only endpoints do not
 * warrant a new dependency, and `fetch` is already typed via `@types/node`
 * in this service. Technical decision, 2026-08-14.
 *
 * Every method throws on failure (network error, timeout, non-2xx) instead
 * of degrading silently: a failed name resolution or finance-owner lookup
 * must never produce a notification with a missing name — the caller is
 * expected to leave the triggering Redis stream entry unacknowledged so it
 * is retried later (see EventProcessorService / docs/architecture.md >
 * "Systeme de notifications transversal").
 */
@Injectable()
export class ProfileServiceClient {
  private readonly logger = new Logger(ProfileServiceClient.name);
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  private readonly requestTimeoutMs = 5000;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>('PROFILE_SERVICE_URL');
    this.internalSecret = this.config.getOrThrow<string>('INTERNAL_SECRET');
  }

  /**
   * Resolve firstName/lastName for a batch of userIds via
   * `POST /internal/profiles/display-names`. A userId absent from
   * profile-service's own response (data anomaly on its side, or an
   * account without an administrative profile) is simply absent from the
   * returned Map — callers must treat a missing entry as a resolution
   * failure, never fabricate a name.
   */
  async resolveDisplayNames(userIds: string[]): Promise<Map<string, DisplayName>> {
    const uniqueIds = [...new Set(userIds)];
    const map = new Map<string, DisplayName>();
    if (uniqueIds.length === 0) {
      return map;
    }

    const body = await this.request<{ displayNames: Array<{ userId: string; firstName: string | null; lastName: string | null }> }>(
      'POST',
      '/internal/profiles/display-names',
      { userIds: uniqueIds },
    );

    for (const entry of body.displayNames ?? []) {
      map.set(entry.userId, { firstName: entry.firstName, lastName: entry.lastName });
    }
    return map;
  }

  /**
   * List the finance-owner (parent) userIds of a student via
   * `GET /internal/relations/finance-owners/:studentId` — route documented
   * in `docs/architecture.md` > "Systeme de notifications transversal",
   * point 5, owned by profile-service and delivered in parallel of this
   * work. If it is not yet deployed when this client calls it, the request
   * fails like any other network error: the caller must not acknowledge
   * the triggering event.
   */
  async getFinanceOwners(studentId: string): Promise<string[]> {
    const body = await this.request<{ studentId: string; financeOwnerUserIds: string[] }>(
      'GET',
      `/internal/relations/finance-owners/${studentId}`,
    );
    return body.financeOwnerUserIds ?? [];
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`profile-service ${method} ${path} responded with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(`Call to profile-service failed (${method} ${path}): ${(error as Error).message}`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

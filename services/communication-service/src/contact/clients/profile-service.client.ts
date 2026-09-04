import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DisplayName {
  userId: string;
  firstName: string | null;
  lastName: string | null;
}

export interface NameSearchResult {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  loginIdentifier: string | null;
}

/**
 * Outbound HTTP client to profile-service's internal API (`X-Internal-Secret`), never exposed
 * by api-gateway — same discipline as every other interservice caller in this project.
 */
@Injectable()
export class ProfileServiceClient {
  private readonly logger = new Logger(ProfileServiceClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return this.config.getOrThrow<string>('PROFILE_SERVICE_URL');
  }

  private headers(): Record<string, string> {
    return {
      'X-Internal-Secret': this.config.getOrThrow<string>('INTERNAL_SECRET'),
      'Content-Type': 'application/json',
    };
  }

  /**
   * docs/routes.md > profile-service > API interne > GET /internal/profiles/:userId/display-name
   * (already exists — no blocker here). Returns null on 404 (unknown userId), never throws for
   * that case — an unresolved name must degrade gracefully, not break the caller.
   */
  async getDisplayName(userId: string): Promise<DisplayName | null> {
    const response = await this.safeFetch(`${this.baseUrl()}/internal/profiles/${userId}/display-name`);
    if (!response) return null;
    if (response.status === 404) return null;
    if (!response.ok) throw new ServiceUnavailableException('profile-service unavailable');
    return response.json();
  }

  /**
   * docs/routes.md > profile-service > API interne > POST /internal/profiles/display-names
   * (already exists — no blocker here). Batch variant, used to resolve a whole contact list in
   * one call rather than one call per row.
   */
  async getDisplayNames(userIds: string[]): Promise<DisplayName[]> {
    if (userIds.length === 0) return [];
    const response = await this.safeFetch(`${this.baseUrl()}/internal/profiles/display-names`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
    if (!response || !response.ok) return [];
    const body = await response.json();
    return body.displayNames ?? [];
  }

  /**
   * docs/routes.md > profile-service > API interne > GET /internal/relations/finance-owners/:studentId
   * (already exists — no blocker here). Used to derive the parent<->teacher default contact.
   */
  async getFinanceOwners(studentId: string): Promise<string[]> {
    const response = await this.safeFetch(`${this.baseUrl()}/internal/relations/finance-owners/${studentId}`);
    if (!response || !response.ok) return [];
    const body = await response.json();
    return body.financeOwnerUserIds ?? [];
  }

  /**
   * docs/routes.md > profile-service > API interne > GET /internal/relations/teachers/:studentId
   * (already exists — no blocker here). Symmetric lookup used when a finance-owner link appears
   * first (must also derive contacts with the student's already-linked teachers).
   */
  async getTeachers(studentId: string): Promise<string[]> {
    const response = await this.safeFetch(`${this.baseUrl()}/internal/relations/teachers/${studentId}`);
    if (!response || !response.ok) return [];
    const body = await response.json();
    return body.teacherUserIds ?? [];
  }

  /**
   * NOT YET BUILT on profile-service — see the session report for the exact contract requested.
   * Expected: `GET /internal/profiles/search-by-name?q=...` (X-Internal-Secret), response
   * `{ results: NameSearchResult[] }`, each result already carrying `loginIdentifier` (composed
   * server-side with identity-access-service, same way GET /profiles/:userId already does).
   * Calling this today will fail with a network/404 error until profile-service implements it —
   * that failure is surfaced to the caller as 503, not swallowed.
   */
  async searchByName(query: string): Promise<NameSearchResult[]> {
    const url = new URL(`${this.baseUrl()}/internal/profiles/search-by-name`);
    url.searchParams.set('q', query);
    const response = await this.safeFetch(url.toString());
    if (!response) {
      throw new ServiceUnavailableException(
        'profile-service: GET /internal/profiles/search-by-name is not available yet',
      );
    }
    if (!response.ok) throw new ServiceUnavailableException('profile-service unavailable');
    const body = await response.json();
    return body.results ?? [];
  }

  private async safeFetch(url: string, init?: RequestInit): Promise<Response | null> {
    try {
      return await fetch(url, { ...init, headers: this.headers() });
    } catch (error) {
      this.logger.warn(`profile-service call failed (${url}): ${error}`);
      return null;
    }
  }
}

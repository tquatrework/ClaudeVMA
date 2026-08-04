import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Shape returned by profile-service's public `GET /profiles/:userId` endpoint. */
export interface ProfileNameLookup {
  firstName: string;
  lastName: string;
}

const PROFILE_LOOKUP_TIMEOUT_MS = 3000;

/**
 * Thin typed adapter for the read-only profile-service call used to enrich
 * teacher requests with human-readable display names.
 *
 * Best-effort by design: this is a display convenience, not a business
 * invariant of teacher-request-service. Any failure (timeout, network
 * error, 4xx/5xx) resolves to `null` instead of failing the caller's use
 * case — TeacherRequestService never lets an interservice read break
 * request creation, listing or status transitions.
 *
 * Follow-up (not yet wired): propagate the inbound `x-correlation-id` once
 * a transversal @CorrelationId() decorator is introduced for this service,
 * matching the pattern already used in calendar-service.
 */
@Injectable()
export class ProfileServiceClient {
  private readonly logger = new Logger(ProfileServiceClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('PROFILE_SERVICE_URL') ?? 'http://profile-service:3000';
  }

  async resolveDisplayName(profileId: string, correlationId?: string): Promise<string | null> {
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), PROFILE_LOOKUP_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/profiles/${profileId}`, {
        signal: abortController.signal,
        headers: correlationId ? { 'x-correlation-id': correlationId } : undefined,
      });
      if (!response.ok) return null;
      const profile = (await response.json()) as ProfileNameLookup;
      return `${profile.firstName} ${profile.lastName}`.trim() || null;
    } catch (error) {
      this.logger.warn(`Could not resolve profile name for id ${profileId}: ${(error as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

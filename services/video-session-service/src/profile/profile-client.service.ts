import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Timeout for the outbound call to profile-service (same value documented for
 * archive-document-service's equivalent dependency, docs/routes.md). */
const REQUEST_TIMEOUT_MS = 3000;

interface DisplayNameResponse {
  userId: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * ProfileClientService — resolves a person's display name from `profile-service`
 * via the internal, secret-protected route `GET /internal/profiles/:userId/display-name`
 * (arbitrage 2026-08-12, "Resolution des noms entre services").
 *
 * This is the fix for the LiveKit participant-tile bug found by the 2026-08-19
 * Playwright smoke test: `GET /video/rooms/:id/join` used to build the LiveKit
 * `AccessToken` with only `identity` (the raw `userId`), so `@livekit/components-react`
 * fell back to displaying the UUID as the participant's name (violation of the
 * "no UUID shown to a user" rule, docs/architecture.md, arbitrage 2026-08-09).
 *
 * Best-effort only: never throws. A failure (profile-service unreachable, timeout,
 * unknown userId, malformed response) resolves to `null`, and the caller must
 * never fall back to displaying the raw userId as a name — it simply omits `name`
 * from the LiveKit access token, and the LiveKit client falls back to `identity`
 * on its own (not a new bug: the pre-fix behaviour, kept as a documented
 * degradation limited to the failure case, never the nominal path).
 */
@Injectable()
export class ProfileClientService {
  private readonly logger = new Logger(ProfileClientService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Resolves `firstName lastName` for `userId`. Returns `null` on any failure,
   * including a missing/empty configured base URL — this method is designed to
   * never block or fail the caller's own flow.
   */
  async resolveDisplayName(userId: string): Promise<string | null> {
    const baseUrl = this.config.get<string>('PROFILE_SERVICE_URL');
    const internalSecret = this.config.get<string>('INTERNAL_SECRET');

    if (!baseUrl || !internalSecret) {
      this.logger.warn(
        'PROFILE_SERVICE_URL or INTERNAL_SECRET is not configured — cannot resolve display name.',
      );
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/internal/profiles/${userId}/display-name`, {
        method: 'GET',
        headers: { 'x-internal-secret': internalSecret },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `profile-service returned ${response.status} for display-name(${userId}); ` +
            'falling back to no name.',
        );
        return null;
      }

      const body = (await response.json()) as DisplayNameResponse;
      const fullName = [body.firstName, body.lastName].filter(Boolean).join(' ').trim();
      return fullName.length > 0 ? fullName : null;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve display name for ${userId}: ${(error as Error).message}. ` +
          'Falling back to no name — the LiveKit identity remains functional.',
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

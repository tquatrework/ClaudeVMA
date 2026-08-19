import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

/**
 * LiveKitService — thin wrapper around `livekit-server-sdk`.
 *
 * The LiveKit server is auto-hosted on the same machine, on its own dedicated
 * host ports, outside `nginx-global` and outside `visiomath_gateway`
 * (architecture decision 2026-08-19, docs/architecture.md not yet updated by
 * this session — see the report for the full rationale). Two distinct URLs are
 * required and both come exclusively from configuration, never hard-coded:
 *
 *   - `LIVEKIT_API_URL`    server-to-server (RoomServiceClient), reachable only
 *                          from inside the Docker network today.
 *   - `LIVEKIT_PUBLIC_URL` the browser SDK connects directly to LiveKit (not
 *                          through api-gateway), so this must be an address the
 *                          client machine can actually reach.
 *
 * This class is the single seam mocked by unit tests — no test in this service
 * makes a real network call to a LiveKit server.
 */
@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly roomService: RoomServiceClient;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiUrl = this.config.get<string>('LIVEKIT_API_URL') ?? '';
    this.apiKey = this.config.get<string>('LIVEKIT_API_KEY') ?? '';
    this.apiSecret = this.config.get<string>('LIVEKIT_API_SECRET') ?? '';
    this.publicUrl = this.config.get<string>('LIVEKIT_PUBLIC_URL') ?? '';
    this.roomService = new RoomServiceClient(apiUrl, this.apiKey, this.apiSecret);
  }

  /**
   * Creates a real LiveKit room. LiveKit's `createRoom` is itself idempotent by
   * name (calling it twice with the same name returns the existing room instead
   * of failing), which this service relies on for the automatic-creation path.
   */
  async createRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.createRoom({ name: roomName });
    } catch (error) {
      this.logger.error(
        `Failed to create LiveKit room "${roomName}": ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('Video provider is currently unavailable');
    }
  }

  /**
   * Builds a scoped JWT granting `userId` the right to join `roomName`, exactly
   * as the LiveKit client SDK expects it. Role is carried as metadata only (not
   * used for LiveKit-side authorisation) — VisioMath's own role-based access
   * control (VID-FB-001 etc.) is enforced before this method is ever called.
   *
   * `identity` (technical, internal to LiveKit) stays the raw `userId` — LiveKit
   * needs it to tell participants apart. `name` (optional) is the human-readable
   * display name; `@livekit/components-react` shows `name` on participant tiles
   * and only falls back to `identity` when `name` is absent. Passing the raw
   * `userId` as `name` would violate "no UUID shown to a user"
   * (docs/architecture.md, arbitrage 2026-08-09) — this is the bug fixed on
   * 2026-08-19 (`.claude/reports/video-session-service-fix-participant-name-2026-08-19.md`).
   * Callers must resolve a real display name first (see `ProfileClientService`)
   * and pass `undefined`/`null` rather than the userId when resolution fails.
   */
  async createAccessToken(
    roomName: string,
    userId: string,
    userRole: string,
    name?: string | null,
  ): Promise<string> {
    const options: ConstructorParameters<typeof AccessToken>[2] = {
      identity: userId,
      metadata: JSON.stringify({ role: userRole }),
    };
    if (name) {
      options.name = name;
    }
    const accessToken = new AccessToken(this.apiKey, this.apiSecret, options);
    accessToken.addGrant({ roomJoin: true, room: roomName });
    return accessToken.toJwt();
  }

  /** URL the browser's LiveKit SDK connects to directly. */
  getPublicUrl(): string {
    return this.publicUrl;
  }
}

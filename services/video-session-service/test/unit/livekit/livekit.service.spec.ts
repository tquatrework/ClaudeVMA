import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LiveKitService } from '../../../src/livekit/livekit.service';

// ─── Mock the LiveKit SDK — no test in this service makes a real network call ──

const mockCreateRoom = jest.fn();
const mockAddGrant = jest.fn();
const mockToJwt = jest.fn();

jest.mock('livekit-server-sdk', () => {
  return {
    RoomServiceClient: jest.fn().mockImplementation(() => ({
      createRoom: mockCreateRoom,
    })),
    AccessToken: jest.fn().mockImplementation(() => ({
      addGrant: mockAddGrant,
      toJwt: mockToJwt,
    })),
  };
});

function buildConfigService(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('LiveKitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createRoom() ────────────────────────────────────────────────────────────

  describe('createRoom()', () => {
    it('calls RoomServiceClient.createRoom with the given room name', async () => {
      mockCreateRoom.mockResolvedValue({});
      const service = new LiveKitService(buildConfigService());

      await service.createRoom('room-name-1');

      expect(mockCreateRoom).toHaveBeenCalledWith({ name: 'room-name-1' });
    });

    it('throws ServiceUnavailableException when LiveKit is unreachable', async () => {
      mockCreateRoom.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = new LiveKitService(buildConfigService());

      await expect(service.createRoom('room-name-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ── createAccessToken() ─────────────────────────────────────────────────────

  describe('createAccessToken()', () => {
    it('builds a token scoped to the room with a roomJoin grant', async () => {
      mockToJwt.mockResolvedValue('signed-jwt');
      const service = new LiveKitService(
        buildConfigService({ LIVEKIT_API_KEY: 'key', LIVEKIT_API_SECRET: 'secret' }),
      );

      const token = await service.createAccessToken('room-name-1', 'user-1', 'eleve');

      expect(token).toBe('signed-jwt');
      expect(mockAddGrant).toHaveBeenCalledWith({ roomJoin: true, room: 'room-name-1' });
    });
  });

  // ── getPublicUrl() ──────────────────────────────────────────────────────────

  describe('getPublicUrl()', () => {
    it('returns the configured LIVEKIT_PUBLIC_URL', () => {
      const service = new LiveKitService(
        buildConfigService({ LIVEKIT_PUBLIC_URL: 'https://livekit.example.com' }),
      );

      expect(service.getPublicUrl()).toBe('https://livekit.example.com');
    });

    it('returns an empty string when LIVEKIT_PUBLIC_URL is not configured', () => {
      const service = new LiveKitService(buildConfigService());
      expect(service.getPublicUrl()).toBe('');
    });
  });
});

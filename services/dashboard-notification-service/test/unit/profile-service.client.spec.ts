import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProfileServiceClient } from '../../src/events/profile-service.client';

const mockConfigService = () => ({
  getOrThrow: jest.fn((key: string) => {
    if (key === 'PROFILE_SERVICE_URL') return 'http://profile-service:3002';
    if (key === 'INTERNAL_SECRET') return 'test-internal-secret';
    throw new Error(`Unexpected config key requested in test: ${key}`);
  }),
});

describe('ProfileServiceClient', () => {
  let client: ProfileServiceClient;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [ProfileServiceClient, { provide: ConfigService, useFactory: mockConfigService }],
    }).compile();

    client = moduleRef.get<ProfileServiceClient>(ProfileServiceClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveDisplayNames', () => {
    it('returns an empty map without calling fetch for an empty list', async () => {
      const result = await client.resolveDisplayNames([]);

      expect(result.size).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('calls the batch route with the internal secret and deduplicated userIds', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          displayNames: [
            { userId: 'user-1', firstName: 'Camille', lastName: 'Durand' },
            { userId: 'user-2', firstName: 'Alex', lastName: null },
          ],
        }),
      });

      const result = await client.resolveDisplayNames(['user-1', 'user-2', 'user-1']);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://profile-service:3002/internal/profiles/display-names',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Internal-Secret': 'test-internal-secret' }),
          body: JSON.stringify({ userIds: ['user-1', 'user-2'] }),
        }),
      );
      expect(result.get('user-1')).toEqual({ firstName: 'Camille', lastName: 'Durand' });
      expect(result.get('user-2')).toEqual({ firstName: 'Alex', lastName: null });
    });

    it('leaves a userId absent from the response absent from the returned map', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ displayNames: [{ userId: 'user-1', firstName: 'Camille', lastName: 'Durand' }] }),
      });

      const result = await client.resolveDisplayNames(['user-1', 'user-2']);

      expect(result.has('user-1')).toBe(true);
      expect(result.has('user-2')).toBe(false);
    });

    it('throws when profile-service responds with a non-2xx status', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });

      await expect(client.resolveDisplayNames(['user-1'])).rejects.toThrow(/503/);
    });

    it('propagates a network failure', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.resolveDisplayNames(['user-1'])).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('getFinanceOwners', () => {
    it('calls the finance-owners route for the given studentId', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ studentId: 'student-1', financeOwnerUserIds: ['parent-1', 'parent-2'] }),
      });

      const result = await client.getFinanceOwners('student-1');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://profile-service:3002/internal/relations/finance-owners/student-1',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(['parent-1', 'parent-2']);
    });

    it('throws when profile-service responds with a non-2xx status', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      await expect(client.getFinanceOwners('student-1')).rejects.toThrow(/404/);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IdentityAccessServiceClient } from '../../src/common/clients/identity-access-service.client';

const mockConfigService = () => ({
  getOrThrow: jest.fn((key: string) => {
    if (key === 'IDENTITY_ACCESS_SERVICE_URL') return 'http://identity-access-service:3001';
    if (key === 'INTERNAL_SECRET') return 'test-internal-secret';
    throw new Error(`Unexpected config key requested in test: ${key}`);
  }),
});

describe('IdentityAccessServiceClient', () => {
  let client: IdentityAccessServiceClient;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [IdentityAccessServiceClient, { provide: ConfigService, useFactory: mockConfigService }],
    }).compile();

    client = moduleRef.get<IdentityAccessServiceClient>(IdentityAccessServiceClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listUserIdsByRole', () => {
    it('calls the internal accounts route filtered by role and returns the userIds', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => [
          { userId: 'rp-1', loginIdentifier: 'rp.un', role: 'responsable_pedagogique', email: 'rp1@test.fr' },
          { userId: 'rp-2', loginIdentifier: 'rp.deux', role: 'responsable_pedagogique', email: 'rp2@test.fr' },
        ],
      });

      const result = await client.listUserIdsByRole('responsable_pedagogique');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://identity-access-service:3001/internal/accounts?role=responsable_pedagogique',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Internal-Secret': 'test-internal-secret' }),
        }),
      );
      expect(result).toEqual(['rp-1', 'rp-2']);
    });

    it('returns an empty list when no account holds the role', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await client.listUserIdsByRole('administrateur_financier');

      expect(result).toEqual([]);
    });

    it('URL-encodes the role query parameter', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

      await client.listUserIdsByRole('responsable pedagogique');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://identity-access-service:3001/internal/accounts?role=responsable%20pedagogique',
        expect.anything(),
      );
    });

    it('throws when identity-access-service responds with a non-2xx status', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });

      await expect(client.listUserIdsByRole('responsable_pedagogique')).rejects.toThrow(/503/);
    });

    it('propagates a network failure', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.listUserIdsByRole('responsable_pedagogique')).rejects.toThrow('ECONNREFUSED');
    });
  });
});

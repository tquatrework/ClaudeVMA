import { ConfigService } from '@nestjs/config';
import { ProfileServiceClient, ProfileServiceUnavailableError } from '../../../src/common/clients/profile-service.client';

/**
 * ProfileServiceClient est le pendant symétrique de IdentityAccessClient côté
 * profile-service (services/profile-service/src/common/clients/identity-access.client.ts).
 *
 * Depuis l'arbitrage d'architecture du 2026-08-06, identity-access-service ne
 * collecte plus du tout firstName/lastName/phone (propriété exclusive de
 * profile-service) : ce client ne porte donc plus que linkParentToStudent
 * (relation finance-owner-student, sans donnée d'identité). Ce client relance
 * systématiquement une erreur typée (ProfileServiceUnavailableError) sur tout
 * échec (réseau, timeout, HTTP non-2xx), afin qu'AccountsService puisse faire
 * échouer/rollback la création de compte plutôt que de perdre silencieusement
 * la liaison financeur/élève.
 */
describe('ProfileServiceClient', () => {
  let client: ProfileServiceClient;
  let configService: any;
  let fetchMock: jest.Mock;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'PROFILE_SERVICE_URL') return 'http://profile-service:3002';
        if (key === 'INTERNAL_SECRET') return 'configured-secret';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    client = new ProfileServiceClient(configService);

    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    errorSpy = jest.spyOn((client as any).logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('linkParentToStudent', () => {
    it('calls POST /internal/link-parent with the correct URL, header and payload on success', async () => {
      fetchMock.mockResolvedValue({ status: 201, ok: true });

      await client.linkParentToStudent({ studentId: 'student-uuid', financeOwnerId: 'parent-uuid' });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://profile-service:3002/internal/link-parent',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Internal-Secret': 'configured-secret',
          }),
          body: JSON.stringify({ studentId: 'student-uuid', financeOwnerId: 'parent-uuid' }),
        }),
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('throws ProfileServiceUnavailableError and logs an error on a network failure / timeout', async () => {
      fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'));

      await expect(
        client.linkParentToStudent({ studentId: 'student-uuid', financeOwnerId: 'parent-uuid' }),
      ).rejects.toThrow(ProfileServiceUnavailableError);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('student-uuid'));
    });

    it('throws ProfileServiceUnavailableError and logs an error on a non-2xx HTTP response', async () => {
      fetchMock.mockResolvedValue({ status: 500, ok: false });

      await expect(
        client.linkParentToStudent({ studentId: 'student-uuid', financeOwnerId: 'parent-uuid' }),
      ).rejects.toThrow(ProfileServiceUnavailableError);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('500'));
    });
  });
});

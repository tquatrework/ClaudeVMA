import { ConfigService } from '@nestjs/config';
import { ProfileServiceClient, ProfileServiceUnavailableError } from '../../../src/common/clients/profile-service.client';

/**
 * ProfileServiceClient est le pendant symétrique de IdentityAccessClient côté
 * profile-service (services/profile-service/src/common/clients/identity-access.client.ts).
 *
 * Décision d'architecture du 2026-08-05 : identity-access-service ne stocke plus
 * firstName/lastName/phone localement — profile-service est l'unique lieu de
 * stockage. Ce client relance donc systématiquement une erreur typée
 * (ProfileServiceUnavailableError) sur tout échec (réseau, timeout, HTTP
 * non-2xx), afin qu'AccountsService puisse faire échouer/rollback la création
 * de compte plutôt que de perdre silencieusement les données saisies.
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

  describe('createAdministrativeProfile', () => {
    it('calls POST /internal/create-administrative-profile with the correct URL, header and payload on success', async () => {
      fetchMock.mockResolvedValue({ status: 201, ok: true });

      await client.createAdministrativeProfile({
        userId: 'user-uuid',
        firstName: 'Jean',
        lastName: 'Dupont',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://profile-service:3002/internal/create-administrative-profile',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Internal-Secret': 'configured-secret',
          }),
          body: JSON.stringify({ userId: 'user-uuid', firstName: 'Jean', lastName: 'Dupont' }),
        }),
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('forwards phoneNumber when provided', async () => {
      fetchMock.mockResolvedValue({ status: 201, ok: true });

      await client.createAdministrativeProfile({
        userId: 'user-uuid',
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: '+33 6 01 02 03 04',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://profile-service:3002/internal/create-administrative-profile',
        expect.objectContaining({
          body: JSON.stringify({
            userId: 'user-uuid',
            firstName: 'Jean',
            lastName: 'Dupont',
            phoneNumber: '+33 6 01 02 03 04',
          }),
        }),
      );
    });

    it('throws ProfileServiceUnavailableError and logs an error with the userId on a network failure / timeout', async () => {
      fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'));

      await expect(
        client.createAdministrativeProfile({ userId: 'user-uuid', firstName: 'Jean', lastName: 'Dupont' }),
      ).rejects.toThrow(ProfileServiceUnavailableError);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('user-uuid'));
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('timeout'));
    });

    it('throws ProfileServiceUnavailableError and logs an error with the userId on a non-2xx HTTP response (e.g. INTERNAL_SECRET mismatch)', async () => {
      fetchMock.mockResolvedValue({ status: 403, ok: false });

      await expect(
        client.createAdministrativeProfile({ userId: 'user-uuid', firstName: 'Jean', lastName: 'Dupont' }),
      ).rejects.toThrow(ProfileServiceUnavailableError);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('user-uuid'));
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('403'));
    });
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

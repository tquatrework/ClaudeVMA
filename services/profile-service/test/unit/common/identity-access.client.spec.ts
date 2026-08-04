import { ConfigService } from '@nestjs/config';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';

/**
 * Regression coverage for the bug where a real interservice config error
 * (e.g. INTERNAL_SECRET mismatch between profile-service and
 * identity-access-service, producing a 401/403) was indistinguishable from a
 * legitimate 404 "account not found" — both degraded silently to null with
 * no trace in the logs. The client must now log a distinct, loud error for
 * any non-404 non-2xx status and for network/timeout failures, while still
 * throwing a typed IdentityAccessUnavailableError so the caller can degrade
 * gracefully.
 */
describe('IdentityAccessClient', () => {
  let client: IdentityAccessClient;
  let configService: any;
  let fetchMock: jest.Mock;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'IDENTITY_ACCESS_SERVICE_URL') return 'http://identity-access-service:3001';
        if (key === 'INTERNAL_SECRET') return 'configured-secret';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    client = new IdentityAccessClient(configService);

    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    errorSpy = jest.spyOn((client as any).logger, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn((client as any).logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves the account on a 200 response', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ userId: 'u1', loginIdentifier: 'maman.deuxenfants', role: 'parent_financeur' }),
    });

    const account = await client.findAccountByUserId('u1');

    expect(account.loginIdentifier).toBe('maman.deuxenfants');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('throws IdentityAccessNotFoundError on a 404 without logging an error', async () => {
    fetchMock.mockResolvedValue({ status: 404, ok: false });

    await expect(client.findAccountByUserId('missing-user')).rejects.toBeInstanceOf(
      IdentityAccessNotFoundError,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Regression: an INTERNAL_SECRET mismatch (or any other auth/config issue)
  // between the two services surfaces as a non-404 non-2xx status (401/403).
  // This must be logged at error level, distinct from the 404 case, so a
  // config drift is detectable in observability instead of silently
  // degrading every profile read.
  it('throws IdentityAccessUnavailableError and logs an error on a 401 (e.g. INTERNAL_SECRET mismatch)', async () => {
    fetchMock.mockResolvedValue({ status: 401, ok: false });

    await expect(client.findAccountByUserId('u1')).rejects.toBeInstanceOf(IdentityAccessUnavailableError);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('401'));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws IdentityAccessUnavailableError and logs an error on a 403', async () => {
    fetchMock.mockResolvedValue({ status: 403, ok: false });

    await expect(client.findAccountByUserId('u1')).rejects.toBeInstanceOf(IdentityAccessUnavailableError);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('throws IdentityAccessUnavailableError and logs an error on a network failure / timeout', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'));

    await expect(client.findAccountByUserId('u1')).rejects.toBeInstanceOf(IdentityAccessUnavailableError);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('timeout'));
  });
});

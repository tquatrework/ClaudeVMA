import { ConfigService } from '@nestjs/config';
import { ProfileClientService } from '../../../src/profile/profile-client.service';

function buildConfigService(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('ProfileClientService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function buildService(values: Record<string, string> = {}): ProfileClientService {
    return new ProfileClientService(
      buildConfigService({
        PROFILE_SERVICE_URL: 'http://profile-service:3002',
        INTERNAL_SECRET: 'shared-secret',
        ...values,
      }),
    );
  }

  it('resolves "firstName lastName" on a successful lookup', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { userId: 'user-1', firstName: 'Camille', lastName: 'Durand' }),
      );
    global.fetch = mockFetch as unknown as typeof fetch;

    const service = buildService();
    const name = await service.resolveDisplayName('user-1');

    expect(name).toBe('Camille Durand');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://profile-service:3002/internal/profiles/user-1/display-name',
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-internal-secret': 'shared-secret' },
      }),
    );
  });

  it('never sends the raw userId as a name — returns null on 404 (unknown user)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, {})) as unknown as typeof fetch;

    const service = buildService();
    const name = await service.resolveDisplayName('unknown-user');

    expect(name).toBeNull();
  });

  it('returns null when profile-service responds 500 (data inconsistency upstream)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, {})) as unknown as typeof fetch;

    const service = buildService();
    const name = await service.resolveDisplayName('user-1');

    expect(name).toBeNull();
  });

  it('returns null and never throws when profile-service is unreachable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const service = buildService();
    await expect(service.resolveDisplayName('user-1')).resolves.toBeNull();
  });

  it('returns null when both firstName and lastName are null', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { userId: 'user-1', firstName: null, lastName: null }));

    const service = buildService();
    const name = await service.resolveDisplayName('user-1');

    expect(name).toBeNull();
  });

  it('builds a partial name when only one of firstName/lastName is present', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { userId: 'user-1', firstName: 'Camille', lastName: null }),
      );

    const service = buildService();
    const name = await service.resolveDisplayName('user-1');

    expect(name).toBe('Camille');
  });

  it('returns null without calling fetch when PROFILE_SERVICE_URL is not configured', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    const service = buildService({ PROFILE_SERVICE_URL: '' });
    const name = await service.resolveDisplayName('user-1');

    expect(name).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null without calling fetch when INTERNAL_SECRET is not configured', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    const service = buildService({ INTERNAL_SECRET: '' });
    const name = await service.resolveDisplayName('user-1');

    expect(name).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null when the response body is malformed JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Unexpected token')),
    }) as unknown as typeof fetch;

    const service = buildService();
    await expect(service.resolveDisplayName('user-1')).resolves.toBeNull();
  });
});

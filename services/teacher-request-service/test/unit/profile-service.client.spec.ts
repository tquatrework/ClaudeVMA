import { ConfigService } from '@nestjs/config';

import { ProfileServiceClient } from '../../src/teacher-request/clients/profile-service.client';

describe('ProfileServiceClient', () => {
  const originalFetch = global.fetch;
  let configService: { get: jest.Mock };
  let client: ProfileServiceClient;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('http://profile-service:3000') };
    client = new ProfileServiceClient(configService as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('resolves a display name from a successful response (nominal)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ firstName: 'Alice', lastName: 'Dupont' }),
    }) as unknown as typeof fetch;

    const result = await client.resolveDisplayName('student-1');

    expect(result).toBe('Alice Dupont');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://profile-service:3000/profiles/student-1',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('propagates the correlation id header when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ firstName: 'Bob', lastName: 'Martin' }),
    }) as unknown as typeof fetch;

    await client.resolveDisplayName('teacher-1', 'corr-42');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://profile-service:3000/profiles/teacher-1',
      expect.objectContaining({ headers: { 'x-correlation-id': 'corr-42' } }),
    );
  });

  it('returns null on a non-ok response (access denied / not found)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const result = await client.resolveDisplayName('unknown-id');

    expect(result).toBeNull();
  });

  it('returns null and does not throw on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const result = await client.resolveDisplayName('student-1');

    expect(result).toBeNull();
  });

  it('falls back to the default profile-service URL when unconfigured', async () => {
    configService.get.mockReturnValue(undefined);
    client = new ProfileServiceClient(configService as unknown as ConfigService);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ firstName: 'Alice', lastName: 'Dupont' }),
    }) as unknown as typeof fetch;

    await client.resolveDisplayName('student-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://profile-service:3000/profiles/student-1',
      expect.anything(),
    );
  });
});

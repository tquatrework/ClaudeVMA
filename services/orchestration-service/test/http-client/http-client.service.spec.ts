import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { HttpClientService } from '../../src/http-client/http-client.service';

const makeHttpServiceMock = () => ({
  post: jest.fn(),
});

const makeConfigServiceMock = (overrides: Record<string, string> = {}) => ({
  get: jest.fn((key: string) => {
    const defaults: Record<string, string> = {
      IDENTITY_ACCESS_SERVICE_URL: 'http://identity:3001',
      INTERNAL_SECRET: 'secret-test',
    };
    return overrides[key] ?? defaults[key] ?? undefined;
  }),
});

describe('HttpClientService', () => {
  let service: HttpClientService;
  let httpService: ReturnType<typeof makeHttpServiceMock>;
  let configService: ReturnType<typeof makeConfigServiceMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpClientService,
        { provide: HttpService, useFactory: makeHttpServiceMock },
        { provide: ConfigService, useFactory: makeConfigServiceMock },
      ],
    }).compile();

    service = module.get(HttpClientService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  describe('buildStepIdempotencyKey — ORCH-HTTP-001', () => {
    it('builds key in format wf:<instanceId>:step:<order>', () => {
      const key = service.buildStepIdempotencyKey('inst-abc', 3);
      expect(key).toBe('wf:inst-abc:step:3');
    });
  });

  describe('call — success path — ORCH-HTTP-002', () => {
    it('calls the correct internal URL with correlation and idempotency headers', async () => {
      httpService.post.mockReturnValue(of({ data: { accountId: 'acc-1' }, status: 201 }));

      const result = await service.call({
        service: 'identity-access-service',
        action: 'create-account',
        payload: { email: 'a@b.com' },
        correlationId: 'corr-1',
        idempotencyKey: 'key-123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ accountId: 'acc-1' });
      expect(result.statusCode).toBe(201);

      const [url, , options] = httpService.post.mock.calls[0];
      expect(url).toBe('http://identity:3001/internal/create-account');
      expect(options.headers['x-correlation-id']).toBe('corr-1');
      expect(options.headers['x-idempotency-key']).toBe('key-123');
      expect(options.headers['x-internal-secret']).toBe('secret-test');
    });

    it('omits idempotency header when key is not provided — ORCH-HTTP-003', async () => {
      httpService.post.mockReturnValue(of({ data: {}, status: 200 }));

      await service.call({
        service: 'identity-access-service',
        action: 'create-account',
        payload: {},
        correlationId: 'corr-2',
      });

      const [, , options] = httpService.post.mock.calls[0];
      expect(options.headers['x-idempotency-key']).toBeUndefined();
    });
  });

  describe('call — failure path — ORCH-HTTP-004', () => {
    it('returns success: false with extracted error message on HTTP error', async () => {
      httpService.post.mockReturnValue(
        throwError(() => ({
          response: { status: 503, data: { message: 'Service down' } },
          message: 'Request failed',
        })),
      );

      const result = await service.call({
        service: 'identity-access-service',
        action: 'create-account',
        payload: {},
        correlationId: 'corr-3',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service down');
      expect(result.statusCode).toBe(503);
    });

    it('falls back to err.message when response body has no message field — ORCH-HTTP-005', async () => {
      httpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} }, message: 'network error' })),
      );

      const result = await service.call({
        service: 'identity-access-service',
        action: 'create-account',
        payload: {},
        correlationId: 'corr-4',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('network error');
    });
  });

  describe('call — unconfigured service — ORCH-HTTP-006', () => {
    it('returns success: true with skipped flag when service URL is not configured', async () => {
      const result = await service.call({
        service: 'unknown-service',
        action: 'do-something',
        payload: {},
        correlationId: 'corr-5',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ skipped: true, reason: 'service-not-configured' });
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });
});

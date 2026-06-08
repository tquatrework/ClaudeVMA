import { CorrelationMiddleware } from '../../../../src/common/middleware/correlation.middleware';

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;

  beforeEach(() => {
    middleware = new CorrelationMiddleware();
  });

  const makeRes = () => {
    const headers: Record<string, string> = {};
    return {
      setHeader: jest.fn((key: string, val: string) => { headers[key] = val; }),
      _headers: headers,
    };
  };

  describe('ORCH-MW-001 — x-correlation-id header present', () => {
    it('forwards existing x-correlation-id to req and res', () => {
      const req: any = { headers: { 'x-correlation-id': 'existing-corr' } };
      const res = makeRes();
      const next = jest.fn();

      middleware.use(req, res as any, next);

      expect(req.correlationId).toBe('existing-corr');
      expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'existing-corr');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('ORCH-MW-002 — x-correlation-id header absent', () => {
    it('generates a new UUID and sets it on req and res when header is missing', () => {
      const req: any = { headers: {} };
      const res = makeRes();
      const next = jest.fn();

      middleware.use(req, res as any, next);

      expect(typeof req.correlationId).toBe('string');
      expect(req.correlationId.length).toBeGreaterThan(0);
      expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.correlationId);
      expect(next).toHaveBeenCalled();
    });

    it('generates a different UUID on each request — ORCH-MW-003', () => {
      const req1: any = { headers: {} };
      const req2: any = { headers: {} };
      const res = makeRes();
      const next = jest.fn();

      middleware.use(req1, res as any, next);
      middleware.use(req2, makeRes() as any, next);

      expect(req1.correlationId).not.toBe(req2.correlationId);
    });
  });
});

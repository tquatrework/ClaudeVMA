import { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from '../../src/common/correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  const runMiddleware = (headers: Record<string, string | string[] | undefined>) => {
    const request = { headers } as { headers: Record<string, string | string[] | undefined>; correlationId?: string };
    const setHeader = jest.fn();
    const next = jest.fn();
    middleware.use(request, { setHeader }, next);
    return { request, setHeader, next };
  };

  it('reprend la correlation fournie par la gateway', () => {
    const { request, setHeader, next } = runMiddleware({ [CORRELATION_ID_HEADER]: 'corr-42' });

    expect(request.correlationId).toBe('corr-42');
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'corr-42');
    expect(next).toHaveBeenCalled();
  });

  it('en genere une quand l\'appel n\'en porte pas', () => {
    const { request, setHeader } = runMiddleware({});

    expect(request.correlationId).toEqual(expect.any(String));
    expect(request.correlationId?.length).toBeGreaterThan(0);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, request.correlationId);
  });

  it('ignore une valeur vide plutot que de propager une correlation illisible', () => {
    const { request } = runMiddleware({ [CORRELATION_ID_HEADER]: '   ' });

    expect(request.correlationId?.trim().length).toBeGreaterThan(0);
    expect(request.correlationId).not.toBe('   ');
  });

  it('retient la premiere valeur quand l\'en-tete est repete', () => {
    const { request } = runMiddleware({ [CORRELATION_ID_HEADER]: ['corr-1', 'corr-2'] });

    expect(request.correlationId).toBe('corr-1');
  });
});

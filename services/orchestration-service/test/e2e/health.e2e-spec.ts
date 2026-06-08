/**
 * E2E — Health check (smoke test)
 *
 * Contrat technique : chaque service expose GET /health → { status: "ok", service: "..." }
 * Source : docs/routes.md — "Health checks (non authentifié)"
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './helpers/app.helper';

describe('[E2E] GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok — no auth required', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'orchestration-service',
    });
  });
});

/**
 * E2E — Callbacks
 *
 * Couvre la route du CallbackController :
 *   POST /callbacks/:provider  — recevoir un callback d'un fournisseur externe
 *
 * Source : src/callback/callback.controller.ts
 *
 * Cette route est publique (pas de JwtAuthGuard) — les webhooks externes
 * n'ont pas de JWT. Elle enregistre l'événement et répond { received: true }.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './helpers/app.helper';
import { v4 as uuidv4 } from 'uuid';

describe('[E2E] POST /callbacks/:provider', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // Pas d'authentification requise
  // ──────────────────────────────────────────────────────────────

  it('returns 200 without a JWT (public webhook endpoint)', async () => {
    const res = await request(app.getHttpServer())
      .post('/callbacks/video-provider')
      .send({
        correlationId: uuidv4(),
        eventType: 'session.ended',
        sessionId: 'sess-001',
      });

    expect(res.status).toBe(200);
  });

  // ──────────────────────────────────────────────────────────────
  // Cas nominal — provider connu et inconnu
  // ──────────────────────────────────────────────────────────────

  it('returns received=true and the correlationId for video-provider', async () => {
    const correlationId = uuidv4();

    const res = await request(app.getHttpServer())
      .post('/callbacks/video-provider')
      .send({
        correlationId,
        eventType: 'session.ended',
        sessionId: 'sess-abc',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('received', true);
    expect(res.body).toHaveProperty('correlationId', correlationId);
  });

  it('accepts any provider name — returns 200 for payment-provider', async () => {
    const correlationId = uuidv4();

    const res = await request(app.getHttpServer())
      .post('/callbacks/payment-provider')
      .send({
        correlationId,
        eventType: 'payment.succeeded',
        amount: 2000,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('received', true);
    expect(res.body).toHaveProperty('correlationId', correlationId);
  });

  it('auto-generates a correlationId when none is provided', async () => {
    const res = await request(app.getHttpServer())
      .post('/callbacks/video-provider')
      .send({
        eventType: 'session.started',
        sessionId: 'sess-no-corr',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('received', true);
    expect(res.body).toHaveProperty('correlationId');
    expect(typeof res.body.correlationId).toBe('string');
    expect(res.body.correlationId.length).toBeGreaterThan(0);
  });

  it('accepts snake_case correlation_id field as well', async () => {
    const correlationId = uuidv4();

    const res = await request(app.getHttpServer())
      .post('/callbacks/legacy-provider')
      .send({
        correlation_id: correlationId,
        event_type: 'webhook.received',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('received', true);
    expect(res.body).toHaveProperty('correlationId', correlationId);
  });

  it('uses event_type when eventType is absent', async () => {
    const res = await request(app.getHttpServer())
      .post('/callbacks/video-provider')
      .send({
        correlation_id: uuidv4(),
        event_type: 'custom.event',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('received', true);
  });

  it('accepts an empty body and still returns 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/callbacks/unknown-provider')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('received', true);
  });
});

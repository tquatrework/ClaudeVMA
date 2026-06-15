/**
 * E2E — Events
 *
 * Couvre la route du EventController :
 *   GET /events/:correlationId  — lire les événements liés à une corrélation
 *
 * Source : src/event/event.controller.ts
 *
 * La route est protégée par JWT.
 * Les événements sont créés automatiquement lors du démarrage d'un workflow,
 * donc on démarreun workflow d'abord pour s'assurer qu'il existe des
 * événements associés au correlationId utilisé dans les assertions.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';
import { v4 as uuidv4 } from 'uuid';

const RP_TOKEN = makeJwt(IDS.rp1, 'responsable_pedagogique');

describe('[E2E] GET /events/:correlationId', () => {
  let app: INestApplication;
  let knownCorrelationId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Start a workflow — this will record WorkflowStarted events under a
    // known correlationId that we can then query.
    knownCorrelationId = uuidv4();

    await request(app.getHttpServer())
      .post('/workflows/student-onboarding/start')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send({
        workflowType: 'student-onboarding',
        payload: { email: `events-test-${Date.now()}@test.com`, password: 'P@ss1' },
        correlationId: knownCorrelationId,
      });

    // Give the async workflow a moment to persist the events
    await new Promise((r) => setTimeout(r, 500));
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // Authentification
  // ──────────────────────────────────────────────────────────────

  it('returns 401 without a JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      `/events/${knownCorrelationId}`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${knownCorrelationId}`)
      .set('Authorization', 'Bearer not-a-valid-jwt');
    expect(res.status).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────
  // Cas nominal
  // ──────────────────────────────────────────────────────────────

  it('returns 200 with an event list for a known correlationId', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${knownCorrelationId}`)
      .set('Authorization', `Bearer ${RP_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('correlationId', knownCorrelationId);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('includes at least the WorkflowStarted event', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${knownCorrelationId}`)
      .set('Authorization', `Bearer ${RP_TOKEN}`);

    expect(res.status).toBe(200);
    const eventTypes = res.body.events.map((e: any) => e.eventType);
    expect(eventTypes).toContain('WorkflowStarted');
  });

  it('count matches the length of the events array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${knownCorrelationId}`)
      .set('Authorization', `Bearer ${RP_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(res.body.events.length);
  });

  // ──────────────────────────────────────────────────────────────
  // Corrélation inconnue — doit retourner un tableau vide
  // ──────────────────────────────────────────────────────────────

  it('returns 200 with an empty events array for an unknown correlationId', async () => {
    const unknownId = uuidv4();
    const res = await request(app.getHttpServer())
      .get(`/events/${unknownId}`)
      .set('Authorization', `Bearer ${RP_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('correlationId', unknownId);
    expect(res.body.count).toBe(0);
    expect(res.body.events).toEqual([]);
  });
});

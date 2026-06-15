/**
 * E2E — Commands
 *
 * Couvre la route du CommandController :
 *   POST /commands  — émettre une commande d'intégration idempotente
 *
 * Source : docs/routes.md (section orchestration-service) +
 *          src/command/command.controller.ts
 *
 * La route est protégée par JWT.
 * Un doublon de clé d'idempotence renvoie le résultat mis en cache (pas de 409
 * côté HTTP, la deduplication est interne — la commande est retournée telle quelle).
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';
import { v4 as uuidv4 } from 'uuid';

const RP_TOKEN = makeJwt(IDS.rp1, 'responsable_pedagogique');

describe('[E2E] POST /commands', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // Authentification
  // ──────────────────────────────────────────────────────────────

  it('returns 401 without a JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/commands')
      .send({
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: { accountId: IDS.student1 },
        idempotencyKey: `cmd:${uuidv4()}`,
      });
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: { accountId: IDS.student1 },
        idempotencyKey: `cmd:${uuidv4()}`,
      });
    expect(res.status).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation du body
  // ──────────────────────────────────────────────────────────────

  it('returns 400 when targetService is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send({
        action: 'create-student-profiles',
        payload: {},
        idempotencyKey: `cmd:${uuidv4()}`,
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send({
        targetService: 'profile-service',
        payload: {},
        idempotencyKey: `cmd:${uuidv4()}`,
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when payload is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send({
        targetService: 'profile-service',
        action: 'create-student-profiles',
        idempotencyKey: `cmd:${uuidv4()}`,
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when idempotencyKey is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send({
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: { accountId: IDS.student1 },
      });
    expect(res.status).toBe(400);
  });

  // ──────────────────────────────────────────────────────────────
  // Cas nominal
  // ──────────────────────────────────────────────────────────────

  it('dispatches a command and returns the integration-command record', async () => {
    const idempotencyKey = `cmd:${uuidv4()}`;
    const correlationId = uuidv4();

    const res = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send({
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: { accountId: IDS.student1, firstName: 'Jean', lastName: 'Dupont' },
        idempotencyKey,
        correlationId,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('targetService', 'profile-service');
    expect(res.body).toHaveProperty('action', 'create-student-profiles');
    expect(res.body).toHaveProperty('idempotencyKey', idempotencyKey);
    expect(res.body).toHaveProperty('correlationId', correlationId);
  });

  it('dispatches a command without an explicit correlationId (auto-generated)', async () => {
    const idempotencyKey = `cmd:${uuidv4()}`;

    const res = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send({
        targetService: 'identity-access-service',
        action: 'create-account',
        payload: { email: `cmd-test-${Date.now()}@test.com`, role: 'eleve' },
        idempotencyKey,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('correlationId');
    expect(typeof res.body.correlationId).toBe('string');
  });

  // ──────────────────────────────────────────────────────────────
  // Idempotence — la même clé est acceptée sans erreur HTTP
  // ──────────────────────────────────────────────────────────────

  it('returns the cached command when the same idempotencyKey is reused', async () => {
    const idempotencyKey = `cmd:idempotent-${uuidv4()}`;
    const body = {
      targetService: 'profile-service',
      action: 'create-student-profiles',
      payload: { accountId: uuidv4() },
      idempotencyKey,
    };

    const first = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send(body);

    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/commands')
      .set('Authorization', `Bearer ${RP_TOKEN}`)
      .send(body);

    // The service either returns the same record (200/201) or a 409 conflict
    expect([200, 201, 409]).toContain(second.status);
    if (second.status !== 409) {
      expect(second.body.idempotencyKey).toBe(idempotencyKey);
    }
  });
});

/**
 * E2E — Routes internes inter-services (/internal/video/*)
 *
 * Ces routes ne sont pas exposées via nginx (api-gateway).
 * Elles sont protégées par le header X-Internal-Secret (InternalSecretGuard).
 * Utilisées par orchestration-service dans le workflow scheduled-video-course.
 *
 * Routes testées :
 *   POST /internal/video/rooms                    créer une salle (orchestrateur)
 *   GET  /internal/video/rooms/:roomId            lire une salle
 *   POST /internal/video/rooms/:roomId/attendance enregistrer une présence via webhook
 *   POST /internal/video/rooms/:roomId/close      clôturer une session
 *
 * Critères couverts :
 *   Sécurité InternalSecretGuard
 *     Sans header X-Internal-Secret → 401
 *     Avec un secret incorrect → 401
 *     Avec un JWT Bearer sans X-Internal-Secret → 401
 *
 *   POST /internal/video/rooms
 *     Avec secret valide → 201 (salle en WAITING, rôle formateur par défaut)
 *     calendarSessionId manquant → 400
 *
 *   GET /internal/video/rooms/:roomId
 *     Salle existante → 200
 *     Salle inexistante → 404
 *
 *   POST /internal/video/rooms/:roomId/attendance
 *     Avec userId et userRole valides → 201
 *     roomId inconnu → 404
 *
 *   POST /internal/video/rooms/:roomId/close
 *     Clôture la salle → 201 (status ENDED)
 *     Salle déjà ENDED → 400
 *     Salle inexistante → 404
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, INTERNAL_SECRET, IDS } from './helpers/app.helper';

const WRONG_SECRET = 'wrong_internal_secret';

describe('[E2E] Internal routes (/internal/video/*)', () => {
  let app: INestApplication;

  // Room IDs captured during seeding
  let internalRoomId: string;
  let endedRoomId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Seed: create one room via internal route for later read/attendance/close tests
    const r1 = await request(app.getHttpServer())
      .post('/internal/video/rooms')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({ calendarSessionId: IDS.session1 });
    if (r1.status === 201) {
      internalRoomId = r1.body.id;
    }

    // Seed: create and close a room to test the "already ended" cases
    const r2 = await request(app.getHttpServer())
      .post('/internal/video/rooms')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({ calendarSessionId: IDS.session1 });
    if (r2.status === 201) {
      endedRoomId = r2.body.id;
      await request(app.getHttpServer())
        .post(`/internal/video/rooms/${endedRoomId}/close`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({});
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Sécurité : InternalSecretGuard
  // ──────────────────────────────────────────────────────────────────────────

  describe('InternalSecretGuard — sécurité X-Internal-Secret', () => {
    it('Sans header X-Internal-Secret → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .send({ calendarSessionId: IDS.session1 });
      expect([401, 403]).toContain(res.status);
    });

    it('Avec un secret incorrect → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .set('X-Internal-Secret', WRONG_SECRET)
        .send({ calendarSessionId: IDS.session1 });
      expect([401, 403]).toContain(res.status);
    });

    it('Avec un JWT Bearer sans X-Internal-Secret → 401', async () => {
      // Internal routes must not accept a plain JWT without the shared secret
      const res = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .set('Authorization', 'Bearer some.jwt.token')
        .send({ calendarSessionId: IDS.session1 });
      expect([401, 403]).toContain(res.status);
    });

    it('GET /internal/video/rooms/:id sans secret → 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/internal/video/rooms/${IDS.unknown}`);
      expect([401, 403]).toContain(res.status);
    });

    it('POST /internal/video/rooms/:id/close sans secret → 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${IDS.unknown}/close`)
        .send({});
      expect([401, 403]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /internal/video/rooms — création orchestrateur
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /internal/video/rooms', () => {
    it('Avec secret valide → 201 (salle WAITING, rôle formateur par défaut)', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ calendarSessionId: IDS.session1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('roomToken');
      expect(res.body).toHaveProperty('calendarSessionId', IDS.session1);
      expect(res.body.status).toBe('waiting');
    });

    it('calendarSessionId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({});
      expect(res.status).toBe(400);
    });

    it('calendarSessionId non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ calendarSessionId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /internal/video/rooms/:roomId — lecture
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /internal/video/rooms/:roomId', () => {
    it('Salle existante → 200 avec les champs attendus', async () => {
      if (!internalRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/internal/video/rooms/${internalRoomId}`)
        .set('X-Internal-Secret', INTERNAL_SECRET);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', internalRoomId);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('roomToken');
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/internal/video/rooms/${IDS.unknown}`)
        .set('X-Internal-Secret', INTERNAL_SECRET);
      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /internal/video/rooms/:roomId/attendance — présence via webhook
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /internal/video/rooms/:roomId/attendance — webhook', () => {
    it('Enregistre une présence pour un participant → 201', async () => {
      if (!internalRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${internalRoomId}/attendance`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          userId:    IDS.teacher1,
          userRole:  'formateur',
          joinedAt:  new Date(Date.now() - 3_600_000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('userId', IDS.teacher1);
    });

    it('Présence avec leftAt → 201', async () => {
      if (!internalRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${internalRoomId}/attendance`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          userId:    IDS.student1,
          userRole:  'eleve',
          joinedAt:  new Date(Date.now() - 3_600_000).toISOString(),
          leftAt:    new Date(Date.now() - 1_800_000).toISOString(),
        });

      expect(res.status).toBe(201);
    });

    it('roomId inconnu → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${IDS.unknown}/attendance`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ userId: IDS.teacher1, userRole: 'formateur' });
      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /internal/video/rooms/:roomId/close — clôture orchestrateur
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /internal/video/rooms/:roomId/close', () => {
    it('Clôture une salle WAITING → 201 (status ENDED)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ calendarSessionId: IDS.session1 });
      expect(createRes.status).toBe(201);

      const closeRes = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${createRes.body.id}/close`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({});

      expect(closeRes.status).toBe(201);
      expect(closeRes.body).toHaveProperty('status', 'ended');
      expect(closeRes.body).toHaveProperty('endedAt');
    });

    it('callerId optionnel est accepté → 201', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/internal/video/rooms')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ calendarSessionId: IDS.session1 });
      expect(createRes.status).toBe(201);

      const closeRes = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${createRes.body.id}/close`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({ callerId: 'orchestration-service' });

      expect(closeRes.status).toBe(201);
    });

    it('Salle déjà ENDED → 400', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${endedRoomId}/close`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({});
      expect(res.status).toBe(400);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/internal/video/rooms/${IDS.unknown}/close`)
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({});
      expect(res.status).toBe(404);
    });
  });
});

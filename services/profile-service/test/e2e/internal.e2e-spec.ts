/**
 * E2E — Routes internes inter-services (/internal/*)
 *
 * Ces routes ne sont pas exposées via nginx (api-gateway).
 * Elles sont protégées par le header x-internal-secret (InternalGuard).
 * Utilisées par orchestration-service dans les workflows d'onboarding.
 *
 * Routes testées :
 *   POST /internal/create-student-profiles
 *   POST /internal/create-teacher-profiles
 *   POST /internal/link-parent
 *   POST /internal/create-teacher-student-relation
 *   POST /internal/link-coordinator
 *
 * Source : docs/services/profile-service.md — section InternalController
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, INTERNAL_SECRET, IDS } from './helpers/app.helper';

const WRONG_SECRET = 'wrong_secret';

describe('[E2E] Internal routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // Security : InternalGuard
  // ──────────────────────────────────────────────────────────────

  describe('InternalGuard — sécurité x-internal-secret', () => {
    it('Sans header x-internal-secret → 401 ou 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .send({ userId: IDS.student1, firstName: 'Test', lastName: 'Test' });

      expect([401, 403]).toContain(res.status);
    });

    it('Avec un secret incorrect → 401 ou 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', WRONG_SECRET)
        .send({ userId: IDS.student1, firstName: 'Test', lastName: 'Test' });

      expect([401, 403]).toContain(res.status);
    });

    it('Ces routes ne doivent pas accepter un JWT Bearer standard', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('Authorization', 'Bearer some.jwt.token')
        .send({ userId: IDS.student1, firstName: 'Test', lastName: 'Test' });

      // Sans x-internal-secret, doit être rejeté même avec un JWT
      expect([401, 403]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/create-student-profiles
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/create-student-profiles', () => {
    it('Crée les profils administratif et pédagogique d\'un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId', IDS.student1);
      // Les deux types de profil doivent être créés ou confirmés
      expect(res.body).toHaveProperty('administrativeProfile');
      expect(res.body).toHaveProperty('pedagogicalProfile');
    });

    it('Idempotence : appel en double sur le même userId ne plante pas → 200 ou 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' });

      expect([200, 201, 409]).toContain(res.status);
    });

    it('userId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ firstName: 'Alice', lastName: 'Dupont' });

      expect(res.status).toBe(400);
    });

    it('firstName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student2, lastName: 'Dupont' });

      expect(res.status).toBe(400);
    });

    it('lastName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student2, firstName: 'Alice' });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/create-teacher-profiles
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/create-teacher-profiles', () => {
    it('Crée les profils administratif et pédagogique d\'un formateur → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.teacher1, firstName: 'Bob', lastName: 'Martin' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId', IDS.teacher1);
      expect(res.body).toHaveProperty('administrativeProfile');
      expect(res.body).toHaveProperty('pedagogicalProfile');
    });

    it('Le profil pédagogique formateur contient isAnimateurPedagogique à false par défaut', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.teacher2, firstName: 'Carol', lastName: 'Robert' });

      expect(res.status).toBe(201);
      const pedagogical = res.body.pedagogicalProfile ?? res.body;
      expect(pedagogical).toMatchObject(
        expect.objectContaining({ isAnimateurPedagogique: false }),
      );
    });

    it('userId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ firstName: 'Test' });

      expect(res.status).toBe(400);
    });

    it('firstName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.unknown, lastName: 'Martin' });

      expect(res.status).toBe(400);
    });

    it('lastName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.unknown, firstName: 'Bob' });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/link-parent
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/link-parent', () => {
    it('Lie un parent à un élève → 201 avec champ contacts', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-parent')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ studentId: IDS.student1, financeOwnerId: IDS.parent1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('linked', true);
      expect(res.body).toHaveProperty('contacts');
      expect(res.body.contacts).toContain(IDS.parent1);
    });

    it('financeOwnerId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-parent')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ studentId: IDS.student1 });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/create-teacher-student-relation
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/create-teacher-student-relation', () => {
    it('Crée la relation formateur-élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-student-relation')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('teacherId', IDS.teacher1);
      expect(res.body).toHaveProperty('studentId', IDS.student1);
    });

    it('teacherId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-student-relation')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ studentId: IDS.student1 });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/link-coordinator
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/link-coordinator', () => {
    it('Lie un coordinateur (RP) à un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('coordinatorId', IDS.rp1);
      expect(res.body).toHaveProperty('studentId', IDS.student1);
    });

    it('Lie un coordinateur (AP) à un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.ap1,
          studentId: IDS.student1,
          coordinatorRole: 'animateur_pedagogique',
        });

      expect(res.status).toBe(201);
    });

    it('Doublon coordinateur-élève → 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(409);
    });

    it('coordinatorRole invalide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student2,
          coordinatorRole: 'formateur', // rôle non autorisé
        });

      expect(res.status).toBe(400);
    });

    it('coordinatorId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(400);
    });
  });
});

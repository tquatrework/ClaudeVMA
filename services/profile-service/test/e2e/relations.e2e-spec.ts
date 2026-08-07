/**
 * E2E — Relations métier : finance-owner-student, teacher-student, pedagogical-coordinator
 *
 * Critères couverts (source : docs/services/profile-service.md) :
 *   PROF-BR-005  Un financeur peut être relié à plusieurs élèves
 *   PROF-BR-006  Un élève peut avoir une liste de professeurs liés
 *   PROF-BR-007  Dans sa relation à l'étudiant, un prof peut être professeur principal
 *   PROF-BR-011  Le parent voit tout ce qui concerne les élèves liés, sauf le carnet personnel
 *   PROF-FB-001  Le parent ne doit jamais voir le carnet personnel
 *   PROF-FB-003  Un formateur ne voit pas les profils d'élèves non liés
 *
 * Routes testées :
 *   POST /relations/finance-owner-student
 *   POST /relations/teacher-student
 *   POST /relations/pedagogical-coordinator
 *   GET  /relations/pedagogical-coordinator/:coordinatorId
 *
 * Scénarios manuels couverts :
 *   PROF-TEST-001  Parent lié à deux élèves — voit les deux dossiers, pas les carnets personnels
 *   PROF-TEST-002  Formateur lié à un élève — voit cet élève, pas les autres
 *   PROF-TEST-004  Formateur promu AP — statut visible dans le profil pédagogique
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, INTERNAL_SECRET, IDS } from './helpers/app.helper';

describe('[E2E] Relations', () => {
  let app: INestApplication;

  let rpToken: string;
  let parentToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let studentToken: string;
  let tiToken: string;
  let apToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    rpToken       = makeJwt(IDS.rp1,       'responsable_pedagogique');
    parentToken   = makeJwt(IDS.parent1,   'parent_financeur');
    teacher1Token = makeJwt(IDS.teacher1,  'formateur');
    teacher2Token = makeJwt(IDS.teacher2,  'formateur');
    studentToken  = makeJwt(IDS.student1,  'eleve');
    tiToken       = makeJwt(IDS.ti,        'technicien_informatique');
    apToken       = makeJwt(IDS.ap1,       'animateur_pedagogique');

    // Seed via routes internes
    const h = { 'x-internal-secret': INTERNAL_SECRET };

    await request(app.getHttpServer())
      .post('/internal/create-student-profiles')
      .set(h)
      .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' });

    await request(app.getHttpServer())
      .post('/internal/create-student-profiles')
      .set(h)
      .send({ userId: IDS.student2, firstName: 'Pierre', lastName: 'Lambert' });

    await request(app.getHttpServer())
      .post('/internal/create-teacher-profiles')
      .set(h)
      .send({ userId: IDS.teacher1, firstName: 'Bob', lastName: 'Martin' });

    await request(app.getHttpServer())
      .post('/internal/create-teacher-profiles')
      .set(h)
      .send({ userId: IDS.teacher2, firstName: 'Carol', lastName: 'Robert' });
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // POST /relations/finance-owner-student — PROF-BR-005
  // ──────────────────────────────────────────────────────────────

  describe('POST /relations/finance-owner-student (PROF-BR-005)', () => {
    it('Un RP peut lier un parent à un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/finance-owner-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ financeOwnerId: IDS.parent1, studentId: IDS.student1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('financeOwnerId', IDS.parent1);
      expect(res.body).toHaveProperty('studentId', IDS.student1);
    });

    it('[PROF-BR-005] Un parent peut être lié à un second élève → 201 (PROF-TEST-001)', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/finance-owner-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ financeOwnerId: IDS.parent1, studentId: IDS.student2 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('studentId', IDS.student2);
    });

    it('Doublon parent-élève → 409 Conflict', async () => {
      // Tente de créer le même lien une seconde fois
      const res = await request(app.getHttpServer())
        .post('/relations/finance-owner-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ financeOwnerId: IDS.parent1, studentId: IDS.student1 });

      expect(res.status).toBe(409);
    });

    it('Un parent ne peut pas créer lui-même la liaison → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/finance-owner-student')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ financeOwnerId: IDS.parent1, studentId: IDS.student2 });

      expect(res.status).toBe(403);
    });

    it('Body incomplet → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/finance-owner-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ financeOwnerId: IDS.parent1 }); // studentId manquant

      expect(res.status).toBe(400);
    });

    it('Sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/finance-owner-student')
        .send({ financeOwnerId: IDS.parent1, studentId: IDS.student1 });

      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // GET /relations/finance-owner-student/by-student/:studentId
  // GET /relations/finance-owner-student/:financeOwnerId
  // — enrichissement financeOwnerName / studentName (bug 2026-08-06 :
  //   l'onglet "Parents financeurs" n'affichait que l'UUID du financeur)
  // ──────────────────────────────────────────────────────────────

  describe('GET /relations/finance-owner-student/by-student/:studentId — enrichissement financeOwnerName', () => {
    it('inclut financeOwnerName {firstName, lastName} résolu depuis le profil administratif du financeur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/finance-owner-student/by-student/${IDS.student1}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const link = res.body.find((item: any) => item.financeOwnerId === IDS.parent1);
      expect(link).toBeDefined();
      expect(link).toHaveProperty('financeOwnerName');
      // IDS.parent1 has no administrative profile bootstrapped in this suite's
      // beforeAll (only student1/2 and teacher1/2 are) → profile absent, so
      // financeOwnerName must be null, never make the request fail.
      expect(link.financeOwnerName).toBeNull();
    });

    it('Un RP peut aussi consulter la liste enrichie → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/finance-owner-student/by-student/${IDS.student1}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('financeOwnerName');
    });

    it('Sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get(
        `/relations/finance-owner-student/by-student/${IDS.student1}`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe('GET /relations/finance-owner-student/:financeOwnerId — enrichissement studentName', () => {
    it("inclut studentName {firstName, lastName} résolu depuis le profil administratif de l'élève → 200", async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/finance-owner-student/${IDS.parent1}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const link = res.body.find((item: any) => item.studentId === IDS.student1);
      expect(link).toBeDefined();
      expect(link).toHaveProperty('studentName', { firstName: 'Alice', lastName: 'Dupont' });
    });

    it('Un TI peut aussi consulter la liste enrichie → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/finance-owner-student/${IDS.parent1}`)
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(200);
      const link = res.body.find((item: any) => item.studentId === IDS.student1);
      expect(link.studentName).toEqual({ firstName: 'Alice', lastName: 'Dupont' });
    });

    it('Sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get(
        `/relations/finance-owner-student/${IDS.parent1}`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /relations/teacher-student — PROF-BR-006 / PROF-BR-007
  // ──────────────────────────────────────────────────────────────

  describe('POST /relations/teacher-student (PROF-BR-006, PROF-BR-007)', () => {
    it('Un RP peut lier un formateur à un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student1, isPrincipalTeacher: false });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('teacherId', IDS.teacher1);
      expect(res.body).toHaveProperty('studentId', IDS.student1);
      expect(res.body).toHaveProperty('isPrincipalTeacher', false);
    });

    it('[PROF-BR-007] Un RP peut désigner le professeur principal (isPrincipalTeacher: true) → 201', async () => {
      // Lier teacher2 à student2 d'abord
      await request(app.getHttpServer())
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ teacherId: IDS.teacher2, studentId: IDS.student2, isPrincipalTeacher: false });

      const res = await request(app.getHttpServer())
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student2, isPrincipalTeacher: true });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('isPrincipalTeacher', true);
    });

    it('Doublon formateur-élève → 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student1, isPrincipalTeacher: false });

      expect(res.status).toBe(409);
    });

    it('[PROF-FB-003] Après liaison, teacher1 peut accéder au profil de student1 → 200 (PROF-TEST-002)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
    });

    it('[PROF-FB-003] teacher2 (non lié à student1) ne peut PAS accéder au profil → 403 (PROF-TEST-002)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });

    it('Un formateur ne peut pas créer lui-même la liaison → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student2, isPrincipalTeacher: false });

      expect(res.status).toBe(403);
    });

    it('Body incomplet (teacherId manquant) → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ studentId: IDS.student1 });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /relations/pedagogical-coordinator — PROF-BR-006 (coordinateur)
  // ──────────────────────────────────────────────────────────────

  describe('POST /relations/pedagogical-coordinator', () => {
    it('Un RP peut lier un RP comme coordinateur pédagogique d\'un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/pedagogical-coordinator')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('coordinatorId', IDS.rp1);
      expect(res.body).toHaveProperty('studentId', IDS.student1);
      expect(res.body).toHaveProperty('coordinatorRole', 'responsable_pedagogique');
    });

    it('Un RP peut lier un AP comme coordinateur pédagogique → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/pedagogical-coordinator')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({
          coordinatorId: IDS.ap1,
          studentId: IDS.student1,
          coordinatorRole: 'animateur_pedagogique',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('coordinatorRole', 'animateur_pedagogique');
    });

    it('Doublon coordinateur-élève → 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/pedagogical-coordinator')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(409);
    });

    it('coordinatorRole invalide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/pedagogical-coordinator')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student2,
          coordinatorRole: 'eleve', // rôle non autorisé pour coordinateur
        });

      expect(res.status).toBe(400);
    });

    it('Un parent ne peut pas créer un lien de coordinateur → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/pedagogical-coordinator')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student2,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(403);
    });

    it('Un formateur ne peut pas créer un lien de coordinateur → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/relations/pedagogical-coordinator')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student2,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // GET /relations/pedagogical-coordinator/:coordinatorId
  // ──────────────────────────────────────────────────────────────

  describe('GET /relations/pedagogical-coordinator/:coordinatorId', () => {
    it('Un RP peut lister ses propres liens de coordination → 200 (liste)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/pedagogical-coordinator/${IDS.rp1}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Au moins un lien créé précédemment
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('coordinatorId', IDS.rp1);
    });

    it('Un coordinateur peut consulter ses propres liens → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/pedagogical-coordinator/${IDS.ap1}`)
        .set('Authorization', `Bearer ${apToken}`);

      expect(res.status).toBe(200);
    });

    it('Un TI peut consulter les liens de n\'importe quel coordinateur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/pedagogical-coordinator/${IDS.rp1}`)
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(200);
    });

    it('Un formateur ne peut pas consulter les liens d\'un coordinateur → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/pedagogical-coordinator/${IDS.rp1}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });

    it('Un parent ne peut pas consulter les liens d\'un coordinateur → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/pedagogical-coordinator/${IDS.rp1}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });

    it('Sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/relations/pedagogical-coordinator/${IDS.rp1}`);

      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // PROF-TEST-001 — Vue parent : accès élèves liés, pas carnet personnel
  // ──────────────────────────────────────────────────────────────

  describe('[PROF-TEST-001] Vue parent — deux élèves liés, carnet personnel exclu (PROF-BR-011, PROF-FB-001)', () => {
    it('Un parent lié voit le profil du premier élève → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId', IDS.student1);
    });

    it('Un parent lié voit le profil du second élève → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student2}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId', IDS.student2);
    });

    it('[PROF-FB-001] La réponse profil pour un parent ne contient PAS de carnet personnel', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      // Le carnet personnel est géré par pedagogical-log-service ;
      // ici on vérifie qu'aucun champ "personalNotebook" n'est exposé dans le profil
      expect(res.body).not.toHaveProperty('personalNotebook');
      expect(res.body).not.toHaveProperty('carnetPersonnel');
    });
  });
});

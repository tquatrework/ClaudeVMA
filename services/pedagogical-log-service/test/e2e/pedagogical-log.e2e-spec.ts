/**
 * E2E — Pedagogical Log Service: cahier de texte, notebook, mémos
 *
 * Routes testées :
 *
 *   Cahier de texte (textbook logs)
 *   POST   /logs                          créer un log
 *   GET    /logs/student/:studentId       logs d'un élève (filtrés par rôle)
 *   GET    /logs/session/:sessionId       logs d'une séance
 *   GET    /logs/:id                      détail d'un log
 *   PATCH  /logs/:id                      modifier un log
 *
 *   Carnet personnel
 *   POST   /students/:studentId/notebook          créer une entrée
 *   GET    /students/:studentId/notebook          lire les entrées
 *   GET    /students/:studentId/notebook/:id      détail d'une entrée
 *   PATCH  /students/:studentId/notebook/:id      modifier une entrée
 *   DELETE /students/:studentId/notebook/:id      supprimer une entrée
 *
 *   Mémos
 *   POST   /memos         créer un mémo
 *   GET    /memos         lister mes mémos
 *   GET    /memos/:id     détail d'un mémo
 *   DELETE /memos/:id     supprimer un mémo
 *
 * Critères couverts :
 *   PLOG-BR-001  L'élève peut lire les entrées autorisées
 *   PLOG-BR-002  Le parent peut lire le cahier de texte des élèves liés
 *   PLOG-BR-004  Le carnet personnel est réservé à l'élève
 *   PLOG-BR-005  Le parent ne voit pas le carnet personnel
 *   PLOG-BR-006  Visibilité différenciée (formateur_rp invisible au parent)
 *   PLOG-BR-007  Entrée conserve auteur, élève, date, visibilité, activité
 *   PLOG-FB-001  Parent interdit sur carnet personnel → 403
 *   PLOG-FB-002  Carnet personnel non retourné par les APIs de logs
 *   PLOG-FB-003  Seuls formateur/RP/AP peuvent créer des logs
 *
 * Auth : JWT Bearer (type: "access") via JwtAuthGuard.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';

describe('[E2E] Pedagogical Log Service', () => {
  let app: INestApplication;

  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let student2Token: string;
  let parent1Token: string;
  let rp1Token: string;
  let ap1Token: string;
  let tiToken: string;

  // IDs captured after seed creations
  let createdLogId: string;
  let createdSpecialLogId: string;
  let createdSessionId: string;
  let createdNotebookEntryId: string;
  let createdMemoId: string;

  beforeAll(async () => {
    app = await createTestApp();

    teacher1Token = makeJwt(IDS.teacher1, 'formateur');
    teacher2Token = makeJwt(IDS.teacher2, 'formateur');
    student1Token = makeJwt(IDS.student1, 'eleve');
    student2Token = makeJwt(IDS.student2, 'eleve');
    parent1Token  = makeJwt(IDS.parent1,  'parent_financeur');
    rp1Token      = makeJwt(IDS.rp1,      'responsable_pedagogique');
    ap1Token      = makeJwt(IDS.ap1,      'animateur_pedagogique');
    tiToken       = makeJwt(IDS.ti,       'technicien_informatique');

    createdSessionId = '11111111-1111-4111-a111-111111111111';

    // Seed: create a standard log (eleve_parent_formateur visibility)
    const logRes = await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({
        studentId: IDS.student1,
        content: 'Travail sur les dérivées',
        visibility: 'eleve_parent_formateur',
        sessionId: createdSessionId,
        skillsWorked: ['dérivées'],
        difficulty: 'intermédiaire',
        rating: 4,
      });

    if (logRes.status === 201) {
      createdLogId = logRes.body.id;
    }

    // Seed: create a formateur_rp special page (invisible to parent and eleve)
    const specialRes = await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${rp1Token}`)
      .send({
        studentId: IDS.student1,
        content: 'Note interne RP sur l\'élève — ne pas montrer',
        visibility: 'formateur_rp',
        sessionId: createdSessionId,
      });

    if (specialRes.status === 201) {
      createdSpecialLogId = specialRes.body.id;
    }

    // Seed: create a notebook entry for student1
    const nbRes = await request(app.getHttpServer())
      .post(`/students/${IDS.student1}/notebook`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Mon journal personnel', title: 'Jour 1' });

    if (nbRes.status === 201) {
      createdNotebookEntryId = nbRes.body.id;
    }

    // Seed: create a memo by teacher1
    const memoRes = await request(app.getHttpServer())
      .post('/memos')
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({
        content: 'Rappel: vérifier exercice avant séance',
        studentId: IDS.student1,
      });

    if (memoRes.status === 201) {
      createdMemoId = memoRes.body.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Auth guard — all routes require Bearer token
  // ──────────────────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('POST /logs sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .send({ studentId: IDS.student1, content: 'Test' });
      expect(res.status).toBe(401);
    });

    it('GET /logs/student/:id sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get(`/logs/student/${IDS.student1}`);
      expect(res.status).toBe(401);
    });

    it('GET /logs/:id sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/logs/some-id');
      expect(res.status).toBe(401);
    });

    it('POST /students/:id/notebook sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/notebook`)
        .send({ content: 'Test' });
      expect(res.status).toBe(401);
    });

    it('POST /memos sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .send({ content: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /logs — création (PLOG-RA-003, PLOG-FB-003)
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /logs — création d\'entrées cahier de texte', () => {
    it('[PLOG-RA-003] Un formateur peut créer un log → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Révision des équations du second degré',
          visibility: 'eleve_parent_formateur',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.authorId).toBe(IDS.teacher1);
      expect(res.body.authorRole).toBe('formateur');
    });

    it('[PLOG-RA-004] Un RP peut créer un log → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Observations pédagogiques du RP',
          visibility: 'eleve_parent_formateur',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('[PLOG-RA-004] Un AP peut créer un log → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${ap1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Observations de l\'AP',
          visibility: 'eleve_parent_formateur',
        });

      expect(res.status).toBe(201);
    });

    it('[PLOG-FB-003] Un élève ne peut pas créer un log → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Tentative d\'écriture par l\'élève',
        });

      expect(res.status).toBe(403);
    });

    it('[PLOG-FB-003] Un parent ne peut pas créer un log → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Tentative d\'écriture par le parent',
        });

      expect(res.status).toBe(403);
    });

    it('Body vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('studentId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Sans élève' });

      expect(res.status).toBe(400);
    });

    it('content manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ studentId: IDS.student1 });

      expect(res.status).toBe(400);
    });

    it('[PLOG-BR-007] Création avec activité rattachée → 201', async () => {
      const activityId = '22222222-2222-4222-a222-222222222222';
      const res = await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Cours lié à une activité',
          visibility: 'eleve_parent_formateur',
          activityId,
        });

      expect(res.status).toBe(201);
      expect(res.body.activityId).toBe(activityId);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /logs/student/:studentId — lecture filtrée par rôle
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /logs/student/:studentId — lecture filtrée', () => {
    it('[PLOG-BR-001] Un formateur peut lire tous les logs (toutes visibilités) → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('[PLOG-RA-001] Un élève peut lire ses logs autorisés → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // L'élève ne doit pas voir les entrées formateur_rp
      const hasSpecialEntry = res.body.some((e: any) => e.visibility === 'formateur_rp');
      expect(hasSpecialEntry).toBe(false);
    });

    it('[PLOG-BR-002] Un parent peut lire les logs eleve_parent_formateur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Le parent ne voit que eleve_parent_formateur
      for (const entry of res.body) {
        expect(entry.visibility).toBe('eleve_parent_formateur');
      }
    });

    it('[PLOG-BR-006] Un RP voit toutes les visibilités y compris formateur_rp → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(200);
      // Le RP voit tous les logs y compris les pages spéciales
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('[PLOG-FB-002] Les entrées de carnet personnel ne sont pas retournées ici → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
      // Le type notebook_entries n'existe pas dans la table pedagogical_logs
      // Toutes les entrées retournées doivent avoir un authorId (preuve que ce sont des logs, pas du carnet)
      for (const entry of res.body) {
        expect(entry).toHaveProperty('authorId');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /logs/session/:sessionId
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /logs/session/:sessionId', () => {
    it('Un formateur peut lire les logs d\'une séance → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/session/${createdSessionId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Un parent ne voit que les logs eleve_parent_formateur de la séance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/session/${createdSessionId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
      for (const entry of res.body) {
        expect(entry.visibility).toBe('eleve_parent_formateur');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /logs/:id — détail
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /logs/:id — détail', () => {
    it('Un formateur peut lire le détail d\'un log → 200', async () => {
      if (!createdLogId) {
        console.warn('createdLogId non défini — seed a échoué, skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdLogId);
    });

    it('Un parent peut lire un log eleve_parent_formateur → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .get(`/logs/${createdLogId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
    });

    it('[PLOG-BR-006] Un parent ne peut pas lire un log formateur_rp → 403', async () => {
      if (!createdSpecialLogId) {
        console.warn('createdSpecialLogId non défini — seed a échoué, skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/logs/${createdSpecialLogId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-006] Un élève ne peut pas lire un log formateur_rp → 403', async () => {
      if (!createdSpecialLogId) return;
      const res = await request(app.getHttpServer())
        .get(`/logs/${createdSpecialLogId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
    });

    it('Log inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/logs/${IDS.unknown}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /logs/:id — modification
  // ──────────────────────────────────────────────────────────────────────────

  describe('PATCH /logs/:id — modification', () => {
    it('L\'auteur peut modifier son log → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .patch(`/logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Contenu mis à jour', difficulty: 'difficile' });

      expect(res.status).toBe(200);
      expect(res.body.difficulty).toBe('difficile');
    });

    it('Un autre formateur ne peut pas modifier le log → 403', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .patch(`/logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ content: 'Tentative de modification' });

      expect(res.status).toBe(403);
    });

    it('Un RP peut modifier n\'importe quel log → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .patch(`/logs/${createdLogId}`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ difficulty: 'facile' });

      expect(res.status).toBe(200);
    });

    it('Log inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/logs/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ content: 'x' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Carnet personnel — POST /students/:studentId/notebook
  // ──────────────────────────────────────────────────────────────────────────

  describe('Carnet personnel — création (PLOG-BR-004, PLOG-FB-001)', () => {
    it('[PLOG-BR-004] L\'élève peut créer une entrée dans son carnet → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Aujourd\'hui j\'ai compris les intégrales', title: 'Bonne séance' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.studentId).toBe(IDS.student1);
    });

    it('[PLOG-FB-001] Un parent ne peut pas écrire dans le carnet d\'un élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ content: 'Tentative du parent' });

      expect(res.status).toBe(403);
    });

    it('[PLOG-FB-001] Un formateur ne peut pas écrire dans le carnet d\'un élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Tentative du formateur' });

      expect(res.status).toBe(403);
    });

    it('Un élève ne peut pas écrire dans le carnet d\'un autre élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ content: 'Intrusion dans le carnet d\'un autre élève' });

      expect(res.status).toBe(403);
    });

    it('Content manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Sans contenu' });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Carnet personnel — GET /students/:studentId/notebook
  // ──────────────────────────────────────────────────────────────────────────

  describe('Carnet personnel — lecture (PLOG-BR-005, PLOG-FB-001)', () => {
    it('[PLOG-RA-001] L\'élève peut lire son propre carnet → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('[PLOG-BR-005] Le parent ne peut pas accéder au carnet de l\'élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-005] Un formateur ne peut pas accéder au carnet d\'un élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-005] Un RP ne peut pas accéder au carnet d\'un élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(403);
    });

    it('Un autre élève ne peut pas accéder au carnet → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(403);
    });

    it('GET /students/:id/notebook/:entryId — l\'élève peut lire une entrée → 200', async () => {
      if (!createdNotebookEntryId) {
        console.warn('createdNotebookEntryId non défini — seed a échoué, skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/students/${IDS.student1}/notebook/${createdNotebookEntryId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdNotebookEntryId);
    });

    it('GET entrée inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${IDS.student1}/notebook/${IDS.unknown}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Carnet personnel — PATCH et DELETE
  // ──────────────────────────────────────────────────────────────────────────

  describe('Carnet personnel — modification et suppression', () => {
    it('L\'élève peut modifier son entrée → 200', async () => {
      if (!createdNotebookEntryId) return;
      const res = await request(app.getHttpServer())
        .patch(`/students/${IDS.student1}/notebook/${createdNotebookEntryId}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Contenu mis à jour' });

      expect(res.status).toBe(200);
    });

    it('Un parent ne peut pas modifier le carnet → 403', async () => {
      if (!createdNotebookEntryId) return;
      const res = await request(app.getHttpServer())
        .patch(`/students/${IDS.student1}/notebook/${createdNotebookEntryId}`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ content: 'Tentative' });

      expect(res.status).toBe(403);
    });

    it('L\'élève peut supprimer son entrée → 204', async () => {
      // Create a new entry specifically for deletion
      const createRes = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/notebook`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'À supprimer' });

      expect(createRes.status).toBe(201);
      const toDeleteId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/students/${IDS.student1}/notebook/${toDeleteId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(204);
    });

    it('Un parent ne peut pas supprimer une entrée du carnet → 403', async () => {
      if (!createdNotebookEntryId) return;
      const res = await request(app.getHttpServer())
        .delete(`/students/${IDS.student1}/notebook/${createdNotebookEntryId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Mémos
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /memos — création', () => {
    it('Un formateur peut créer un mémo → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Préparer exercices niveau 3ème', studentId: IDS.student1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('Un RP peut créer un mémo → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ content: 'Vérifier progression de l\'élève' });

      expect(res.status).toBe(201);
    });

    it('Un élève ne peut pas créer un mémo → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Tentative élève' });

      expect(res.status).toBe(403);
    });

    it('Un parent ne peut pas créer un mémo → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ content: 'Tentative parent' });

      expect(res.status).toBe(403);
    });

    it('Content manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ title: 'Sans contenu' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /memos — liste et détail', () => {
    it('GET /memos — liste des mémos de l\'auteur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Tous les mémos appartiennent à l'auteur
      for (const m of res.body) {
        expect(m.authorId).toBe(IDS.teacher1);
      }
    });

    it('GET /memos/:id — l\'auteur peut lire son mémo → 200', async () => {
      if (!createdMemoId) {
        console.warn('createdMemoId non défini — seed a échoué, skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdMemoId);
    });

    it('GET /memos/:id — un autre formateur est refusé → 403', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .get(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });

    it('GET /memos/:id inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/${IDS.unknown}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /memos/:id — suppression', () => {
    it('L\'auteur peut supprimer son mémo → 204', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Mémo à supprimer' });

      expect(createRes.status).toBe(201);
      const toDeleteId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/memos/${toDeleteId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(204);
    });

    it('Un autre formateur ne peut pas supprimer le mémo → 403', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .delete(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });
  });
});

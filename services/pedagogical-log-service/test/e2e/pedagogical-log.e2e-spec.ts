/**
 * E2E — Pedagogical Log Service: cahier de texte, notebook, mémos élève
 *
 * Routes testées :
 *
 *   Cahier de texte (textbook logs) — /pedagogical-logs
 *   GET    /pedagogical-logs                          lister (eleve, parent, formateur, RP, AP)
 *   POST   /pedagogical-logs                          créer un log (formateur, RP uniquement)
 *   GET    /pedagogical-logs/:id                      détail d'un log
 *   PUT    /pedagogical-logs/:id                      modifier un log (auteur)
 *   DELETE /pedagogical-logs/:id                      supprimer un log (auteur ou RP)
 *   GET    /pedagogical-logs/student/:studentId       logs d'un élève (filtrés par rôle)
 *   GET    /pedagogical-logs/session/:sessionId       logs d'une séance
 *   PATCH  /pedagogical-logs/:id                      modifier partiel (auteur, RP, TI)
 *
 *   Carnet personnel
 *   POST   /students/:studentId/notebook          créer une entrée
 *   GET    /students/:studentId/notebook          lire les entrées
 *   GET    /students/:studentId/notebook/:id      détail d'une entrée
 *   PATCH  /students/:studentId/notebook/:id      modifier une entrée
 *   DELETE /students/:studentId/notebook/:id      supprimer une entrée
 *
 *   Mémos élève — /memos (formulaire structuré appartenant à l'élève)
 *   GET    /memos         lister mes mémos (élève uniquement)
 *   POST   /memos         créer un mémo (élève uniquement)
 *   GET    /memos/:id     détail d'un mémo (élève propriétaire + formateur/RP/AP en lecture)
 *   PUT    /memos/:id     modifier un mémo (élève propriétaire uniquement)
 *   DELETE /memos/:id     supprimer un mémo (élève propriétaire uniquement)
 *
 * Critères couverts :
 *   PLOG-BR-001  L'élève peut lire les entrées autorisées
 *   PLOG-BR-002  Le parent peut lire le cahier de texte des élèves liés
 *   PLOG-BR-003  Le mémo appartient à l'élève — le formateur ne peut pas écrire
 *   PLOG-BR-004  Le carnet personnel est réservé à l'élève
 *   PLOG-BR-005  Le parent ne voit pas le carnet personnel
 *   PLOG-BR-006  Visibilité différenciée (formateur_rp invisible au parent)
 *   PLOG-FB-001  Parent interdit sur carnet personnel → 403
 *   PLOG-FB-002  Carnet personnel non retourné par les APIs de logs
 *   PLOG-FB-003  Seuls formateur/RP peuvent créer des logs (élève → 403)
 *
 * Auth : JWT Bearer (type: "access") via JwtAuthGuard.
 */

import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';
import { PedagogicalLog } from '../../src/pedagogical-log/entities/pedagogical-log.entity';

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
  let adminFinancierToken: string;

  // IDs capturés après les seed creations
  let createdLogId: string;
  let createdSpecialLogId: string;
  let createdSessionId: string;
  let createdNotebookEntryId: string;
  let createdMemoId: string;

  beforeAll(async () => {
    app = await createTestApp();

    teacher1Token       = makeJwt(IDS.teacher1,       'formateur');
    teacher2Token       = makeJwt(IDS.teacher2,       'formateur');
    student1Token       = makeJwt(IDS.student1,       'eleve');
    student2Token       = makeJwt(IDS.student2,       'eleve');
    parent1Token        = makeJwt(IDS.parent1,        'parent_financeur');
    rp1Token            = makeJwt(IDS.rp1,            'responsable_pedagogique');
    ap1Token            = makeJwt(IDS.ap1,            'animateur_pedagogique');
    tiToken             = makeJwt(IDS.ti,             'technicien_informatique');
    adminFinancierToken = makeJwt(IDS.adminFinancier, 'administrateur_financier');

    createdSessionId = '11111111-1111-4111-a111-111111111111';

    // Seed: créer un log standard (visibilité eleve_parent_formateur)
    const logRes = await request(app.getHttpServer())
      .post('/pedagogical-logs')
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

    // Seed: créer une page spéciale formateur_rp (invisible au parent et à l'élève)
    const specialRes = await request(app.getHttpServer())
      .post('/pedagogical-logs')
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

    // Seed: créer une entrée de carnet pour student1
    const notebookRes = await request(app.getHttpServer())
      .post(`/students/${IDS.student1}/notebook`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Mon journal personnel', title: 'Jour 1' });

    if (notebookRes.status === 201) {
      createdNotebookEntryId = notebookRes.body.id;
    }

    // Seed: créer un mémo par student1 (l'élève est propriétaire)
    const memoRes = await request(app.getHttpServer())
      .post('/memos')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        content: 'Formule du second degré : ax²+bx+c=0',
        title: 'Algèbre — mémo',
      });

    if (memoRes.status === 201) {
      createdMemoId = memoRes.body.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Auth guard — toutes les routes nécessitent un token Bearer
  // ──────────────────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('POST /pedagogical-logs sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .send({ studentId: IDS.student1, content: 'Test' });
      expect(res.status).toBe(401);
    });

    it('GET /pedagogical-logs sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/pedagogical-logs');
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

    it('GET /memos sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/memos');
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /pedagogical-logs — création (PLOG-RA-003, PLOG-FB-003)
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /pedagogical-logs — création d\'entrées cahier de texte', () => {
    it('[PLOG-RA-003] Un formateur peut créer un log → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
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
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Observations pédagogiques du RP',
          visibility: 'eleve_parent_formateur',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('[PLOG-FB-003] Un AP ne peut pas créer un log via POST /pedagogical-logs → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${ap1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Tentative AP',
          visibility: 'eleve_parent_formateur',
        });

      expect(res.status).toBe(403);
    });

    it('[PLOG-FB-003] Un élève ne peut pas créer un log → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Tentative d\'écriture par l\'élève',
        });

      expect(res.status).toBe(403);
    });

    it('[PLOG-FB-003] Un parent ne peut pas créer un log → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Tentative d\'écriture par le parent',
        });

      expect(res.status).toBe(403);
    });

    it('Body vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('studentId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Sans élève' });

      expect(res.status).toBe(400);
    });

    it('content manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ studentId: IDS.student1 });

      expect(res.status).toBe(400);
    });

    it('[PLOG-BR-007] Création avec activité rattachée → 201', async () => {
      const activityId = '22222222-2222-4222-a222-222222222222';
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs')
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
  // GET /pedagogical-logs — liste globale filtrée par rôle
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /pedagogical-logs — liste globale filtrée', () => {
    it('[PLOG-BR-001] Un élève peut lister les logs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // L'élève ne doit pas voir les entrées formateur_rp
      const hasSpecialEntry = res.body.some((entry: any) => entry.visibility === 'formateur_rp');
      expect(hasSpecialEntry).toBe(false);
    });

    it('[PLOG-BR-002] Un parent peut lister les logs → 200 (uniquement eleve_parent_formateur)', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs')
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const entry of res.body) {
        expect(entry.visibility).toBe('eleve_parent_formateur');
      }
    });

    it('Un formateur peut lister tous les logs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Un RP peut lister tous les logs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs')
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Un AP peut lister les logs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs')
        .set('Authorization', `Bearer ${ap1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Un TI ne peut pas accéder à GET /pedagogical-logs → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs')
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /pedagogical-logs/student/:studentId — lecture filtrée par rôle
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /pedagogical-logs/student/:studentId — lecture filtrée', () => {
    it('[PLOG-BR-001] Un formateur peut lire tous les logs d\'un élève → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('[PLOG-RA-001] Un élève peut lire ses logs autorisés → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // L'élève ne doit pas voir les entrées formateur_rp
      const hasSpecialEntry = res.body.some((entry: any) => entry.visibility === 'formateur_rp');
      expect(hasSpecialEntry).toBe(false);
    });

    it('[PLOG-BR-002] Un parent peut lire les logs eleve_parent_formateur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/student/${IDS.student1}`)
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
        .get(`/pedagogical-logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('[PLOG-FB-002] Les entrées de carnet personnel ne sont pas retournées ici', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/student/${IDS.student1}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
      for (const entry of res.body) {
        expect(entry).toHaveProperty('authorId');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /pedagogical-logs/session/:sessionId
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /pedagogical-logs/session/:sessionId', () => {
    it('Un formateur peut lire les logs d\'une séance → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/session/${createdSessionId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Un parent ne voit que les logs eleve_parent_formateur de la séance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/session/${createdSessionId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
      for (const entry of res.body) {
        expect(entry.visibility).toBe('eleve_parent_formateur');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /pedagogical-logs/:id — détail
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /pedagogical-logs/:id — détail', () => {
    it('Un formateur peut lire le détail d\'un log → 200', async () => {
      if (!createdLogId) {
        console.warn('createdLogId non défini — seed a échoué, skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdLogId);
    });

    it('[PLOG-BR-001] Un élève peut lire un log eleve_parent_formateur → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
    });

    it('[PLOG-BR-002] Un parent peut lire un log eleve_parent_formateur → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
    });

    it('[PLOG-BR-006] Un parent ne peut pas lire un log formateur_rp → 403', async () => {
      if (!createdSpecialLogId) {
        console.warn('createdSpecialLogId non défini — seed a échoué, skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/${createdSpecialLogId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-006] Un élève ne peut pas lire un log formateur_rp → 403', async () => {
      if (!createdSpecialLogId) return;
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/${createdSpecialLogId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
    });

    it('Log inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/${IDS.unknown}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /pedagogical-logs/:id — modification complète (auteur uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  describe('PUT /pedagogical-logs/:id — modification', () => {
    it('L\'auteur peut modifier son log → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .put(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Contenu mis à jour via PUT', difficulty: 'difficile' });

      expect(res.status).toBe(200);
    });

    it('Un autre formateur ne peut pas modifier le log via PUT → 403', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .put(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ content: 'Tentative de modification' });

      expect(res.status).toBe(403);
    });

    it('Un RP peut modifier n\'importe quel log via PUT → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .put(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ difficulty: 'facile' });

      expect(res.status).toBe(200);
    });

    it('Log inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .put(`/pedagogical-logs/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ content: 'x' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /pedagogical-logs/:id — suppression (auteur ou RP)
  // ──────────────────────────────────────────────────────────────────────────

  describe('DELETE /pedagogical-logs/:id — suppression', () => {
    it('L\'auteur peut supprimer son log → 204', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Log à supprimer',
          visibility: 'eleve_parent_formateur',
        });

      expect(createRes.status).toBe(201);
      const toDeleteId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/pedagogical-logs/${toDeleteId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(204);
    });

    it('Un autre formateur ne peut pas supprimer le log → 403', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .delete(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });

    it('Un RP peut supprimer n\'importe quel log → 204', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/pedagogical-logs')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          studentId: IDS.student1,
          content: 'Log supprimé par RP',
          visibility: 'eleve_parent_formateur',
        });

      expect(createRes.status).toBe(201);
      const toDeleteId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/pedagogical-logs/${toDeleteId}`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(204);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /pedagogical-logs/:id — modification partielle (compatibilité)
  // ──────────────────────────────────────────────────────────────────────────

  describe('PATCH /pedagogical-logs/:id — modification partielle', () => {
    it('L\'auteur peut modifier son log → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .patch(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Contenu mis à jour via PATCH', difficulty: 'difficile' });

      expect(res.status).toBe(200);
    });

    it('Un autre formateur ne peut pas modifier le log → 403', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .patch(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ content: 'Tentative de modification' });

      expect(res.status).toBe(403);
    });

    it('Un RP peut modifier n\'importe quel log → 200', async () => {
      if (!createdLogId) return;
      const res = await request(app.getHttpServer())
        .patch(`/pedagogical-logs/${createdLogId}`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ difficulty: 'facile' });

      expect(res.status).toBe(200);
    });

    it('Log inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/pedagogical-logs/${IDS.unknown}`)
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
  // Mémos élève — POST /memos
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /memos — création (PLOG-BR-003)', () => {
    it('[PLOG-BR-003] Un élève peut créer un mémo → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Rappel sur la trigonométrie', title: 'Trigo' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.studentId).toBe(IDS.student1);
    });

    it('[PLOG-BR-003] Un formateur ne peut pas créer un mémo → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Tentative formateur' });

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-003] Un RP ne peut pas créer un mémo → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ content: 'Tentative RP' });

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-003] Un parent ne peut pas créer un mémo → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ content: 'Tentative parent' });

      expect(res.status).toBe(403);
    });

    it('Content manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Sans contenu' });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Mémos élève — GET /memos
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /memos — liste (élève uniquement)', () => {
    it('[PLOG-BR-003] Un élève peut lister ses propres mémos → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Tous les mémos appartiennent à l'élève connecté
      for (const memo of res.body) {
        expect(memo.studentId).toBe(IDS.student1);
      }
    });

    it('[PLOG-BR-003] Un formateur ne peut pas lister les mémos → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-003] Un parent ne peut pas accéder à GET /memos → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos')
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-003] Un RP ne peut pas lister les mémos → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos')
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Mémos élève — GET /memos/:id
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /memos/:id — détail', () => {
    it('[PLOG-BR-003] L\'élève propriétaire peut lire son mémo → 200', async () => {
      if (!createdMemoId) {
        console.warn('createdMemoId non défini — seed a échoué, skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdMemoId);
      expect(res.body.studentId).toBe(IDS.student1);
    });

    it('[PLOG-BR-003] Un formateur peut lire un mémo en lecture seule → 200', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .get(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
    });

    it('[PLOG-BR-003] Un RP peut lire un mémo en lecture seule → 200', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .get(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(200);
    });

    it('[PLOG-BR-003] Un autre élève ne peut pas lire le mémo → 403', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .get(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(403);
    });

    it('Mémo inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/${IDS.unknown}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Mémos élève — PUT /memos/:id (élève propriétaire uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  describe('PUT /memos/:id — modification (élève propriétaire uniquement)', () => {
    it('[PLOG-BR-003] L\'élève propriétaire peut modifier son mémo → 200', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .put(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Formule modifiée par l\'élève', title: 'Mise à jour' });

      expect(res.status).toBe(200);
    });

    it('[PLOG-BR-003] Un formateur ne peut pas modifier le mémo d\'un élève → 403', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .put(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Tentative formateur' });

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-003] Un RP ne peut pas modifier le mémo d\'un élève → 403', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .put(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ content: 'Tentative RP' });

      expect(res.status).toBe(403);
    });

    it('Mémo inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .put(`/memos/${IDS.unknown}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'x' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Mémos élève — DELETE /memos/:id (élève propriétaire uniquement)
  // ──────────────────────────────────────────────────────────────────────────

  describe('DELETE /memos/:id — suppression (élève propriétaire uniquement)', () => {
    it('[PLOG-BR-003] L\'élève propriétaire peut supprimer son mémo → 204', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/memos')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Mémo à supprimer' });

      expect(createRes.status).toBe(201);
      const toDeleteId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/memos/${toDeleteId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(204);
    });

    it('[PLOG-BR-003] Un formateur ne peut pas supprimer le mémo d\'un élève → 403', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .delete(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });

    it('[PLOG-BR-003] Un RP ne peut pas supprimer le mémo d\'un élève → 403', async () => {
      if (!createdMemoId) return;
      const res = await request(app.getHttpServer())
        .delete(`/memos/${createdMemoId}`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Refonte du cahier de texte — 2026-08-20 (routes réellement montées :
  // POST/GET /students/:studentId/pedagogical-log, PATCH /logs/:id)
  //
  // Cet environnement e2e n'a pas de profile-service réel : PROFILE_SERVICE_URL
  // n'est pas configurée. La vérification de relation (point 3) échoue donc
  // fermée en 503, jamais en 201/403 silencieux — c'est le comportement attendu
  // documenté (« échec fermé »), pas une anomalie de ce test. Ces cas confirment
  // que la garde de rôle (403) s'applique AVANT tout appel réseau, et que
  // studentId n'est plus exigé dans le corps (400 aurait signalé l'ancien bug).
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /students/:studentId/pedagogical-log — refonte 2026-08-20 (point 3, point 4)', () => {
    it('[PLOG-FB-003] role RP → 403 explicite avant tout appel réseau (le RP n\'écrit plus les entrées normales)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/pedagogical-log`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ sessionSummary: 'Tentative RP' });

      expect(res.status).toBe(403);
    });

    it('[PLOG-FB-003] role élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/pedagogical-log`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ sessionSummary: 'Tentative élève' });

      expect(res.status).toBe(403);
    });

    it('[PLOG-FB-003] role parent → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/pedagogical-log`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ sessionSummary: 'Tentative parent' });

      expect(res.status).toBe(403);
    });

    it('[point 4] corps sans studentId, avec studentId identique au chemin dans le corps, ou sans aucun corps ' +
      '→ jamais 400 « studentId manquant » (correctif du bug réel) : le chemin fait autorité, ' +
      'l\'échec observé est 503 (profile-service non configuré dans cet environnement e2e), pas 400', async () => {
      const withoutBody = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/pedagogical-log`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});
      expect(withoutBody.status).not.toBe(400);
      expect(withoutBody.status).toBe(503);

      const withRedundantStudentId = await request(app.getHttpServer())
        .post(`/students/${IDS.student1}/pedagogical-log`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ studentId: IDS.student1, sessionSummary: 'x' });
      expect(withRedundantStudentId.status).not.toBe(400);
      expect(withRedundantStudentId.status).toBe(503);
    });
  });

  describe('GET /students/:studentId/pedagogical-log — refonte 2026-08-20 (point 1, point 2, point 6)', () => {
    let repository: Repository<PedagogicalLog>;
    const seededStudentId = IDS.student2;

    beforeAll(async () => {
      repository = app.get<Repository<PedagogicalLog>>(getRepositoryToken(PedagogicalLog));

      // Seed direct via repository (contourne le guard d'écriture désormais
      // soumis à profile-service, non disponible dans cet environnement e2e) :
      // trois entrées de dates différentes + une catégorie parent_formateur.
      await repository.save([
        repository.create({
          studentId: seededStudentId,
          authorId: IDS.teacher1,
          authorRole: 'formateur',
          date: '2026-08-01',
          sessionSummary: 'Séance du 1er août',
          visibility: 'eleve_parent_formateur',
          isSpecialPage: false,
          hiddenFromStudent: false,
        }),
        repository.create({
          studentId: seededStudentId,
          authorId: IDS.teacher1,
          authorRole: 'formateur',
          date: '2026-08-15',
          sessionSummary: 'Séance du 15 août',
          homework: 'Exercices 1 à 3',
          visibility: 'eleve_parent_formateur',
          isSpecialPage: false,
          hiddenFromStudent: false,
        }),
        repository.create({
          studentId: seededStudentId,
          authorId: IDS.teacher1,
          authorRole: 'formateur',
          date: '2026-08-10',
          sessionSummary: 'Message réservé au parent',
          visibility: 'parent_formateur',
          isSpecialPage: false,
          hiddenFromStudent: false,
        }),
      ]);
    });

    it('[point 6] trie du plus récent au plus ancien par date de séance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${seededStudentId}/pedagogical-log`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      const dates = res.body.map((entry: any) => entry.date).filter(Boolean);
      const sorted = [...dates].sort().reverse();
      expect(dates).toEqual(sorted);
    });

    it('[point 6] from/to filtrent sur la date de séance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${seededStudentId}/pedagogical-log`)
        .query({ from: '2026-08-05', to: '2026-08-12' })
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].date).toBe('2026-08-10');
    });

    it('[point 1, CRITIQUE] l\'élève ne voit plus la catégorie parent_formateur (correctif de sens)', async () => {
      const studentToken = makeJwt(seededStudentId, 'eleve');
      const res = await request(app.getHttpServer())
        .get(`/students/${seededStudentId}/pedagogical-log`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const hasParentFormateur = res.body.some((entry: any) => entry.visibility === 'parent_formateur');
      expect(hasParentFormateur).toBe(false);
      expect(res.body).toHaveLength(2);
    });

    it('[point 1, CRITIQUE] le parent voit désormais la catégorie parent_formateur', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${seededStudentId}/pedagogical-log`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(200);
      const hasParentFormateur = res.body.some((entry: any) => entry.visibility === 'parent_formateur');
      expect(hasParentFormateur).toBe(true);
    });

    it('[point 2] les entrées portent date/sessionSummary/homework, jamais de content sur une entrée normale', async () => {
      const res = await request(app.getHttpServer())
        .get(`/students/${seededStudentId}/pedagogical-log`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      for (const entry of res.body) {
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('sessionSummary');
        expect(entry).toHaveProperty('homework');
        expect(entry.content).toBeFalsy();
      }
    });
  });

  describe('PATCH /logs/:id — refonte 2026-08-20 (point 3 : RP ne peut plus modifier une entrée normale)', () => {
    let repository: Repository<PedagogicalLog>;
    let normalEntryId: string;

    beforeAll(async () => {
      repository = app.get<Repository<PedagogicalLog>>(getRepositoryToken(PedagogicalLog));
      const entry = await repository.save(
        repository.create({
          studentId: IDS.student1,
          authorId: IDS.teacher1,
          authorRole: 'formateur',
          date: '2026-08-20',
          sessionSummary: 'Entrée à modifier',
          visibility: 'eleve_parent_formateur',
          isSpecialPage: false,
          hiddenFromStudent: false,
        }),
      );
      normalEntryId = entry.id;
    });

    it('[CRITIQUE] un RP ne peut plus modifier une entrée normale → 403 (mécanisme page spéciale non concerné)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/logs/${normalEntryId}`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ sessionSummary: 'Modifié par RP' });

      expect(res.status).toBe(403);
    });

    it('un formateur non-auteur ne peut pas modifier → 403', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/logs/${normalEntryId}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ sessionSummary: 'Modifié par un autre formateur' });

      expect(res.status).toBe(403);
    });

    it('l\'auteur formateur : la relation est revérifiée à chaque action → 503 (profile-service non configuré ici)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/logs/${normalEntryId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ sessionSummary: 'Modifié par l\'auteur' });

      expect(res.status).toBe(503);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /:id — correctif du 2026-08-20 (relecture du point 3) : DELETE suit
  // désormais le même régime que POST/PATCH — « les autres rôles lisent
  // uniquement » couvre toute écriture, DELETE inclus. Le RP perd le droit de
  // supprimer une entrée normale, garde celui de supprimer une page spéciale.
  // ──────────────────────────────────────────────────────────────────────────

  describe('DELETE /:id — entrée normale (correctif 2026-08-20 : RP ne peut plus supprimer)', () => {
    let repository: Repository<PedagogicalLog>;
    let normalEntryId: string;

    beforeEach(async () => {
      repository = app.get<Repository<PedagogicalLog>>(getRepositoryToken(PedagogicalLog));
      const entry = await repository.save(
        repository.create({
          studentId: IDS.student1,
          authorId: IDS.teacher1,
          authorRole: 'formateur',
          date: '2026-08-20',
          sessionSummary: 'Entrée à supprimer',
          visibility: 'eleve_parent_formateur',
          isSpecialPage: false,
          hiddenFromStudent: false,
        }),
      );
      normalEntryId = entry.id;
    });

    it('[CRITIQUE] un RP ne peut plus supprimer une entrée normale → 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/${normalEntryId}`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(403);
    });

    it('[CRITIQUE] un élève ne peut pas supprimer → 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/${normalEntryId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
    });

    it('[CRITIQUE] un parent ne peut pas supprimer → 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/${normalEntryId}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(403);
    });

    it('un formateur non-auteur ne peut pas supprimer → 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/${normalEntryId}`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });

    it('l\'auteur formateur : la relation est revérifiée à chaque action → 503 (profile-service non configuré ici)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/${normalEntryId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(503);
    });
  });
});

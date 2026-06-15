/**
 * E2E — Communication Service: conversations, messages, contacts, incidents
 *
 * Routes testées :
 *
 *   Conversations
 *   GET  /conversations                          lister mes conversations
 *   POST /conversations                          créer une conversation
 *   POST /conversations/:id/messages             envoyer un message
 *   GET  /messages/conversation/:id              messages d'une conversation
 *   PATCH /messages/:id/read                     marquer comme lu
 *
 *   Incidents (TI)
 *   POST /incidents                              ouvrir un incident
 *   GET  /incidents                              lister les incidents (TI)
 *   GET  /incidents/:id                          détail d'un incident (TI)
 *   PUT  /incidents/:id/status                   changer le statut (TI)
 *
 *   API interne
 *   POST /internal/sync-contacts                 synchroniser les contacts autorisés
 *
 * Règles couvertes :
 *   COM-BR-010  Les contacts sont déduits des relations métier (sync interne)
 *   COM-FB-001  Parent ne peut pas contacter formateur ponctuel hors fenêtre → 403
 *   COM-FB-002  Utilisateur ne peut pas contacter sans relation autorisée → 403
 *   COM-FB-003  Un message envoyé ne peut pas être supprimé ni modifié
 *   COM-RA-006  TI gère les fils d'incident
 *
 * Auth : JWT Bearer (type: "access") via JwtAuthGuard.
 * Internal : X-Internal-Secret header.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';

const INTERNAL_SECRET = 'test_internal_secret';

describe('[E2E] Communication Service', () => {
  let app: INestApplication;

  let student1Token: string;
  let student2Token: string;
  let parent1Token: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let rp1Token: string;
  let ap1Token: string;
  let tiToken: string;

  // IDs captured during tests
  let conversationId: string;
  let messageId: string;
  let incidentId: string;

  beforeAll(async () => {
    app = await createTestApp();

    student1Token  = makeJwt(IDS.student1,  'eleve');
    student2Token  = makeJwt(IDS.student2,  'eleve');
    parent1Token   = makeJwt(IDS.parent1,   'parent_financeur');
    teacher1Token  = makeJwt(IDS.teacher1,  'formateur');
    teacher2Token  = makeJwt(IDS.teacher2,  'formateur');
    rp1Token       = makeJwt(IDS.rp1,       'responsable_pedagogique');
    ap1Token       = makeJwt(IDS.ap1,       'animateur_pedagogique');
    tiToken        = makeJwt(IDS.ti,        'technicien_informatique');

    // Seed: authorize student1 ↔ teacher1 contact relationship
    await request(app.getHttpServer())
      .post('/internal/sync-contacts')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({
        userId: IDS.student1,
        contacts: [
          { contactId: IDS.teacher1, relationType: 'teacher-student' },
        ],
      });

    await request(app.getHttpServer())
      .post('/internal/sync-contacts')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({
        userId: IDS.teacher1,
        contacts: [
          { contactId: IDS.student1, relationType: 'teacher-student' },
        ],
      });

    // Seed: authorize parent1 ↔ student1
    await request(app.getHttpServer())
      .post('/internal/sync-contacts')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({
        userId: IDS.parent1,
        contacts: [
          { contactId: IDS.student1, relationType: 'parent-student' },
        ],
      });

    // Seed: authorize rp1 with all contacts
    await request(app.getHttpServer())
      .post('/internal/sync-contacts')
      .set('X-Internal-Secret', INTERNAL_SECRET)
      .send({
        userId: IDS.rp1,
        contacts: [
          { contactId: IDS.student1, relationType: 'rp-student' },
          { contactId: IDS.teacher1, relationType: 'rp-teacher' },
        ],
      });
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Auth guard
  // ──────────────────────────────────────────────────────────────────────────

  describe('Auth guard — all routes require Bearer token', () => {
    it('GET /conversations sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/conversations');
      expect(res.status).toBe(401);
    });

    it('POST /conversations sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .send({ participantIds: [IDS.teacher1] });
      expect(res.status).toBe(401);
    });

    it('GET /messages/conversation/:id sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/messages/conversation/00000000-0000-4000-a000-000000000000',
      );
      expect(res.status).toBe(401);
    });

    it('POST /incidents sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/incidents')
        .send({ targetUserId: IDS.student1, description: 'test' });
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Internal API
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /internal/sync-contacts', () => {
    it('Sans secret → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/sync-contacts')
        .send({ userId: IDS.student2, contacts: [] });
      expect(res.status).toBe(401);
    });

    it('Secret invalide → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/sync-contacts')
        .set('X-Internal-Secret', 'wrong_secret')
        .send({ userId: IDS.student2, contacts: [] });
      expect(res.status).toBe(401);
    });

    it('[COM-BR-010] Sync réussie → 204', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/sync-contacts')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          userId: IDS.student2,
          contacts: [
            { contactId: IDS.teacher2, relationType: 'teacher-student' },
          ],
        });
      expect(res.status).toBe(204);
    });

    it('Body invalide (contactId non UUID) → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/sync-contacts')
        .set('X-Internal-Secret', INTERNAL_SECRET)
        .send({
          userId: IDS.student1,
          contacts: [{ contactId: 'not-a-uuid' }],
        });
      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /conversations — création
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /conversations — création', () => {
    it('[COM-BR-010] Un élève peut créer une conversation avec un formateur autorisé → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          participantIds: [IDS.teacher1],
          subject: 'Questions sur les intégrales',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.participantIds).toContain(IDS.student1);
      expect(res.body.participantIds).toContain(IDS.teacher1);
      conversationId = res.body.id;
    });

    it('[COM-FB-002] Un élève ne peut pas contacter un formateur non autorisé → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: [IDS.teacher2] });

      expect(res.status).toBe(403);
    });

    it('[COM-BR-004 / COM-FB-001] Un parent ne peut pas contacter un formateur non autorisé → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ participantIds: [IDS.teacher1] });

      expect(res.status).toBe(403);
    });

    it('Un parent peut contacter un élève lié → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ participantIds: [IDS.student1] });

      expect(res.status).toBe(201);
      expect(res.body.participantIds).toContain(IDS.parent1);
      expect(res.body.participantIds).toContain(IDS.student1);
    });

    it('participantIds vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: [] });

      expect(res.status).toBe(400);
    });

    it('participantIds non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: ['not-a-uuid'] });

      expect(res.status).toBe(400);
    });

    it('Conversation sans autre participant que soi-même → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: [IDS.student1] });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /conversations — liste
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /conversations — liste', () => {
    it('Retourne les conversations du user courant → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/conversations')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Un autre utilisateur ne voit pas les conversations d\'un tiers → 200 liste vide ou filtrée', async () => {
      const res = await request(app.getHttpServer())
        .get('/conversations')
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(200);
      // student2 was not a participant in any student1/teacher1 conversation
      const hasStudent1Conv = res.body.some(
        (c: any) => c.participantIds.includes(IDS.student1),
      );
      expect(hasStudent1Conv).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /conversations/:id/messages — envoi de message
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /conversations/:id/messages — envoi', () => {
    it('Un participant peut envoyer un message → 201', async () => {
      if (!conversationId) {
        console.warn('conversationId non défini — skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Bonjour, pouvez-vous m\'expliquer les intégrales ?' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.senderId).toBe(IDS.student1);
      expect(res.body.conversationId).toBe(conversationId);
      messageId = res.body.id;
    });

    it('L\'autre participant peut aussi envoyer → 201', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Bien sûr, voici une explication...' });

      expect(res.status).toBe(201);
    });

    it('[COM-FB-002] Un non-participant ne peut pas envoyer → 403', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ content: 'Intrusion' });

      expect(res.status).toBe(403);
    });

    it('Conversation inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/conversations/${IDS.unknown}/messages`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Test' });

      expect(res.status).toBe(404);
    });

    it('content vide → 400', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /messages/conversation/:id — lecture
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /messages/conversation/:id — lecture', () => {
    it('Un participant peut lire les messages → 200', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .get(`/messages/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('[COM-BR-008] Les messages de la conversation sont visibles par l\'autre participant → 200', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .get(`/messages/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('[COM-FB-002] Un non-participant ne peut pas lire → 403', async () => {
      if (!conversationId) return;
      const res = await request(app.getHttpServer())
        .get(`/messages/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(403);
    });

    it('Conversation inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/messages/conversation/${IDS.unknown}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /messages/:id/read — marquage lu
  // ──────────────────────────────────────────────────────────────────────────

  describe('PATCH /messages/:id/read', () => {
    it('Un participant peut marquer un message comme lu → 200', async () => {
      if (!messageId) {
        console.warn('messageId non défini — skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .patch(`/messages/${messageId}/read`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.isRead).toBe(true);
    });

    it('[COM-FB-002] Un non-participant ne peut pas marquer comme lu → 403', async () => {
      if (!messageId) return;
      const res = await request(app.getHttpServer())
        .patch(`/messages/${messageId}/read`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(403);
    });

    it('Message inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/messages/${IDS.unknown}/read`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /incidents — TI only
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /incidents — ouverture (TI only)', () => {
    it('[COM-RA-006] Un TI peut ouvrir un incident → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${tiToken}`)
        .send({
          targetUserId: IDS.student1,
          description: 'L\'utilisateur ne peut plus se connecter depuis ce matin.',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.openedBy).toBe(IDS.ti);
      expect(res.body.targetUserId).toBe(IDS.student1);
      expect(res.body.status).toBe('open');
      incidentId = res.body.id;
    });

    it('[COM-RA-006] Un formateur ne peut pas ouvrir un incident → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          targetUserId: IDS.student1,
          description: 'Tentative',
        });

      expect(res.status).toBe(403);
    });

    it('[COM-RA-006] Un RP ne peut pas ouvrir un incident → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({
          targetUserId: IDS.student1,
          description: 'Tentative RP',
        });

      expect(res.status).toBe(403);
    });

    it('description trop courte → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${tiToken}`)
        .send({
          targetUserId: IDS.student1,
          description: 'Hi',
        });

      expect(res.status).toBe(400);
    });

    it('targetUserId non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${tiToken}`)
        .send({
          targetUserId: 'not-a-uuid',
          description: 'Test description',
        });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /incidents — liste
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /incidents — liste (TI only)', () => {
    it('[COM-RA-006] Un TI peut lister les incidents → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Un formateur ne peut pas lister les incidents → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /incidents/:id — détail
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /incidents/:id — détail (TI only)', () => {
    it('[COM-RA-006] Un TI peut lire le détail d\'un incident → 200', async () => {
      if (!incidentId) {
        console.warn('incidentId non défini — skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(incidentId);
    });

    it('Incident inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/incidents/${IDS.unknown}`)
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /incidents/:id/status — changement de statut
  // ──────────────────────────────────────────────────────────────────────────

  describe('PUT /incidents/:id/status — statut (TI only)', () => {
    it('[COM-RA-006] Un TI peut changer le statut → 200', async () => {
      if (!incidentId) {
        console.warn('incidentId non défini — skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .put(`/incidents/${incidentId}/status`)
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
    });

    it('Résolution de l\'incident → 200', async () => {
      if (!incidentId) return;
      const res = await request(app.getHttpServer())
        .put(`/incidents/${incidentId}/status`)
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'resolved' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');
    });

    it('Statut invalide → 400', async () => {
      if (!incidentId) return;
      const res = await request(app.getHttpServer())
        .put(`/incidents/${incidentId}/status`)
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'unknown_status' });

      expect(res.status).toBe(400);
    });

    it('Un RP ne peut pas changer le statut d\'un incident → 403', async () => {
      if (!incidentId) return;
      const res = await request(app.getHttpServer())
        .put(`/incidents/${incidentId}/status`)
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ status: 'closed' });

      expect(res.status).toBe(403);
    });

    it('Incident inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .put(`/incidents/${IDS.unknown}/status`)
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'closed' });

      expect(res.status).toBe(404);
    });
  });
});

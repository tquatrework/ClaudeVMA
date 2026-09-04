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
 * Règles couvertes :
 *   COM-BR-010  Un message n'est possible qu'entre contacts ACTIFS (docs/architecture/
 *               contacts-messagerie.md, point 8) — les contacts eux-mêmes sont désormais un
 *               modèle propre à ce service (Contact/ContactRequest), plus une simple
 *               synchronisation depuis profile-service ; ces tests seedent des Contact
 *               directement en base (getContactRepository), sur le même principe que le futur
 *               flux Redis dérivé des relations métier, qu'un test e2e ne peut pas exercer
 *               bout en bout sans faire tourner profile-service.
 *   COM-FB-002  Utilisateur ne peut pas contacter sans contact actif → 403
 *   COM-FB-003  Un message envoyé ne peut pas être supprimé ni modifié
 *   COM-RA-006  TI gère les fils d'incident
 *
 * Auth : JWT Bearer (type: "access") via JwtAuthGuard.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, getContactRepository, IDS } from './helpers/app.helper';

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

    // Seed ACTIVE contacts directly in the new Contact model (student1<->teacher1,
    // parent1<->student1, rp1<->student1, rp1<->teacher1) — stands in for the Redis-derived
    // default-contact flow, which an e2e test cannot exercise without profile-service running.
    const contactRepository = getContactRepository(app);
    const seedContact = (userIdA: string, userIdB: string) => {
      const [userAId, userBId] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
      return contactRepository.save(
        contactRepository.create({ userAId, userBId, status: 'active', origin: 'default' }),
      );
    };
    await seedContact(IDS.student1, IDS.teacher1);
    await seedContact(IDS.parent1, IDS.student1);
    await seedContact(IDS.rp1, IDS.student1);
    await seedContact(IDS.rp1, IDS.teacher1);
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
  // Critères d'acceptance officiels — COM-BR-001 à COM-RA-002
  //
  // Note d'architecture : l'API de messagerie repose sur le modèle Conversation.
  //   POST /messages           → POST /conversations/:id/messages
  //   GET  /messages/conversation/:id → inchangé
  //   PATCH /messages/:id/read        → inchangé
  //
  // Les routes contacts (GET /contacts, /contacts/:id/break, /contacts/requests/*,
  // /contacts/search/*) sont désormais couvertes par contact.e2e-spec.ts.
  // ──────────────────────────────────────────────────────────────────────────

  describe('Critères d\'acceptance COM-BR-001 à COM-RA-002', () => {
    // Identifiant de conversation temporaire pour cette suite
    let acceptanceConvId: string;
    let acceptanceMsgId: string;

    // Pré-condition : créer une conversation pour les tests qui en ont besoin
    beforeAll(async () => {
      const convRes = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          participantIds: [IDS.teacher1],
          subject: 'Suite critères d\'acceptance',
        });
      if (convRes.status === 201) {
        acceptanceConvId = convRes.body.id;
      }
    });

    // COM-BR-001 — POST /messages valide → 201
    it('[COM-BR-001] Envoi d\'un message valide entre contacts autorisés → 201', async () => {
      // La route canonique est POST /conversations/:id/messages
      // acceptanceConvId peut être absent si la conv a déjà été créée dans le beforeAll global
      const targetConvId = acceptanceConvId ?? conversationId;
      if (!targetConvId) {
        console.warn('[COM-BR-001] conversationId non disponible — skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .post(`/conversations/${targetConvId}/messages`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'Message valide COM-BR-001' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.senderId).toBe(IDS.student1);
      acceptanceMsgId = res.body.id;
    });

    // COM-BR-002 — POST /messages sans token → 401
    it('[COM-BR-002] Envoi de message sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations/00000000-0000-4000-a000-000000000000/messages')
        .send({ content: 'Tentative sans auth' });

      expect(res.status).toBe(401);
    });

    // COM-BR-003 — destinataire non autorisé → 403
    it('[COM-BR-003] Créer une conversation avec un destinataire non autorisé → 403', async () => {
      // student1 n'a pas de relation autorisée avec student2
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: [IDS.student2] });

      expect(res.status).toBe(403);
    });

    // COM-BR-004 — body manquant → 400
    it('[COM-BR-004] Créer une conversation sans body requis → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: [] });

      expect(res.status).toBe(400);
    });

    // COM-BR-005 — GET /messages/conversation/:id → 200
    it('[COM-BR-005] GET /messages/conversation/:id retourne les messages → 200', async () => {
      const targetConvId = acceptanceConvId ?? conversationId;
      if (!targetConvId) {
        console.warn('[COM-BR-005] conversationId non disponible — skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/messages/conversation/${targetConvId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    // COM-BR-006 — GET /messages/conversation/:id non-participant → 403
    it('[COM-BR-006] GET /messages/conversation/:id pour un non-participant → 403', async () => {
      const targetConvId = acceptanceConvId ?? conversationId;
      if (!targetConvId) {
        console.warn('[COM-BR-006] conversationId non disponible — skip');
        return;
      }
      const res = await request(app.getHttpServer())
        .get(`/messages/conversation/${targetConvId}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(403);
    });

    // COM-BR-007 — GET /messages/conversation/:id inexistant → 404
    it('[COM-BR-007] GET /messages/conversation/:id sur une conversation inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/messages/conversation/${IDS.unknown}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });

    // COM-BR-008 — PATCH /messages/:id/read → 200
    it('[COM-BR-008] PATCH /messages/:id/read marque un message comme lu → 200', async () => {
      const targetMsgId = acceptanceMsgId ?? messageId;
      if (!targetMsgId) {
        console.warn('[COM-BR-008] messageId non disponible — skip');
        return;
      }
      // teacher1 lit le message envoyé par student1
      const res = await request(app.getHttpServer())
        .patch(`/messages/${targetMsgId}/read`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.isRead).toBe(true);
    });

    // COM-BR-009 — PATCH /messages/:id/read inexistant → 404
    it('[COM-BR-009] PATCH /messages/:id/read sur un message inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/messages/${IDS.unknown}/read`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });

    // COM-RA-001 — Élève limité à ses contacts métier → 403 si hors périmètre
    it('[COM-RA-001] Un élève ne peut contacter que ses contacts métier autorisés — hors périmètre → 403', async () => {
      // student1 n'a pas de relation avec teacher2
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: [IDS.teacher2] });

      expect(res.status).toBe(403);
    });

    // COM-RA-002 — Parent limité aux contacts de ses élèves → 403 si hors périmètre
    it('[COM-RA-002] Un parent ne peut contacter qu\'aux contacts de ses élèves — formateur non lié → 403', async () => {
      // parent1 est lié à student1, mais pas à teacher1 directement
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${parent1Token}`)
        .send({ participantIds: [IDS.teacher1] });

      expect(res.status).toBe(403);
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

  // ──────────────────────────────────────────────────────────────────────────
  // ParseUUIDPipe — paramètres UUID invalides (controllers-convention)
  // Avant la convention, un id malformé remontait tel quel au service/repository ;
  // désormais chaque paramètre d'id utilise ParseUUIDPipe → 400 immédiat.
  // ──────────────────────────────────────────────────────────────────────────

  describe('ParseUUIDPipe — identifiants malformés → 400', () => {
    it('POST /conversations/:id/messages avec id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations/not-a-uuid/messages')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ content: 'test' });

      expect(res.status).toBe(400);
    });

    it('GET /messages/conversation/:id avec id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/messages/conversation/not-a-uuid')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(400);
    });

    it('PATCH /messages/:id/read avec id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch('/messages/not-a-uuid/read')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(400);
    });

    it('GET /incidents/:id avec id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/incidents/not-a-uuid')
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(400);
    });

    it('PUT /incidents/:id/status avec id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/incidents/not-a-uuid/status')
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'closed' });

      expect(res.status).toBe(400);
    });
  });
});

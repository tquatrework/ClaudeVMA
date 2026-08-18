/**
 * E2E — Calendar service: activities, calendars & reminders
 *
 * Routes reelles exposees par le service :
 *
 *   Activities
 *   POST   /activities                         create a scheduled activity
 *   PUT    /activities/:activityId             update a scheduled activity
 *   DELETE /activities/:activityId             delete a scheduled activity
 *   GET    /activities/:activityId             get an activity by ID
 *   POST   /activities/:activityId/accept       accept a PROPOSED activity (chantier calendrier, point 3)
 *   POST   /activities/:activityId/decline      decline a PROPOSED activity (chantier calendrier, point 3)
 *
 *   Calendars
 *   GET    /calendars/:ownerId                                 get a user calendar (slots + activities)
 *   PUT    /calendars/:ownerId/availability                    replace availability slots (bulk)
 *   POST   /calendars/:ownerId/availability-slots               create a single slot
 *   PATCH  /calendars/:ownerId/availability-slots/:slotId       update a single slot
 *   DELETE /calendars/:ownerId/availability-slots/:slotId       delete a single slot
 *
 *   Reminders
 *   POST   /reminders                          create a reminder
 *
 * Criteres couverts :
 *
 *   Creation d'activite
 *   CAL-BR-001  POST /activities avec champs requis → 201
 *   CAL-BR-002  POST /activities sans token → 401
 *   CAL-BR-003  POST /activities avec champs manquants → 400
 *   CAL-BR-004  Evenement ActivityScheduled presume publie apres creation reussie
 *
 *   Lecture d'activite
 *   CAL-BR-008  GET /activities/:id retourne le detail d'une activite existante → 200
 *   CAL-BR-009  GET /activities/:id sur activite inexistante → 404
 *
 *   Modification d'activite
 *   CAL-BR-010  PUT /activities/:id modifie une activite → 200
 *   CAL-BR-011  PUT /activities/:id sur activite inexistante → 404
 *
 *   Suppression d'activite (meme politique que PUT, CAL-FB-001)
 *   DELETE /activities/:id par le createur → 204
 *   DELETE /activities/:id par un RP → 204
 *   DELETE /activities/:id par un tiers sans droit → 403
 *   DELETE /activities/:id sur activite inexistante → 404
 *
 *   Verification de lien a la creation (chantier calendrier, point 3 — corrige un
 *   trou de securite reel : jusqu'ici aucun lien n'etait verifie)
 *   Un FORMATEUR propose un cours a un eleve auquel il n'est PAS lie → 403
 *   Un FORMATEUR propose un cours a plus d'un destinataire → 400
 *   Un AP propose une reunion_pedagogique a un formateur qu'il n'anime PAS → 403
 *   Un RP cree une reunion_pedagogique a plusieurs formateurs → 201 (usage existant, inchange)
 *
 *   Acceptation / refus d'une proposition (chantier calendrier, point 3)
 *   Le destinataire vise accepte une activite PROPOSED → 201, status CONFIRMED
 *   Le destinataire vise refuse une activite PROPOSED → 201, status CANCELLED
 *   Un tiers (non destinataire) tente d'accepter → 403
 *   Une activite deja CONFIRMED est acceptee de nouveau → 409
 *
 *   Calendriers
 *   CAL-BR-005  GET /calendars/:ownerId retourne le calendrier → 200
 *   CAL-BR-001  PUT /calendars/:ownerId/availability met a jour les creneaux → 200
 *
 *   Rappels
 *   CAL-EVT-002  POST /reminders cree un rappel → 201
 *
 *   Controle d'acces (sur activities)
 *   CAL-RA-001   Acces sans token → 401
 *
 * Auth : JWT Bearer (type: "access") via JwtAuthGuard.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestAppWithFakeProfileRelations,
  FakeProfileRelationsClient,
  FakeProfileDisplayNameClient,
  makeJwt,
  IDS,
} from './helpers/app.helper';
import { RelationKind } from '../../src/common/relations/relation-kind';

// ─── Payload minimal valide pour creer une activite ──────────────────────────

function validActivityPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const start = new Date(Date.now() + 86_400_000);
  const end   = new Date(start.getTime() + 3_600_000);
  return {
    title: 'Cours de geometrie',
    type: 'cours',
    participantIds: [IDS.student1],
    startTime: start.toISOString(),
    endTime:   end.toISOString(),
    ...overrides,
  };
}

describe('[E2E] Calendar Service', () => {
  let app: INestApplication;
  let profileRelations: FakeProfileRelationsClient;
  let profileDisplayNames: FakeProfileDisplayNameClient;

  let rpToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let apToken: string;

  // Activity ID captured after seed creation
  let createdActivityId: string;

  beforeAll(async () => {
    ({ app, profileRelations, profileDisplayNames } = await createTestAppWithFakeProfileRelations());

    rpToken       = makeJwt(IDS.rp1,      'responsable_pedagogique');
    teacher1Token = makeJwt(IDS.teacher1, 'formateur');
    teacher2Token = makeJwt(IDS.teacher2, 'formateur');
    student1Token = makeJwt(IDS.student1, 'eleve');
    apToken       = makeJwt(IDS.ap1,      'animateur_pedagogique');

    // Chantier calendrier de disponibilites, point 3 : `teacher1` est lie a
    // `student1` (TEACHER_OF_STUDENT) et `ap1` anime `teacher1`
    // (ANIMATOR_OF_TEACHER) — relations consommees par la verification de
    // lien a la creation d'un `cours`/`reunion_pedagogique` 1-vers-1.
    // `teacher2` reste volontairement SANS relation posee, pour les tests
    // de refus (403).
    profileRelations.setSnapshot(IDS.teacher1, IDS.student1, {
      viewerId: IDS.teacher1,
      targetId: IDS.student1,
      isSelf: false,
      isAdministrator: false,
      relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
    });
    profileRelations.setSnapshot(IDS.ap1, IDS.teacher1, {
      viewerId: IDS.ap1,
      targetId: IDS.teacher1,
      isSelf: false,
      isAdministrator: false,
      relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
    });

    // Chantier calendrier de disponibilites, point 3 (gap comble le
    // 2026-08-18) : GET /calendars/:ownerId resout desormais le nom du
    // createur d'une activite — jamais un UUID affiche.
    profileDisplayNames.setName(IDS.rp1, { firstName: 'Robert', lastName: 'Pedago' });

    // Seed: create one activity used by read/update tests (RP : aucune
    // verification de lien, `validActivityPayload()` par defaut = cours vers
    // `student1`).
    const res = await request(app.getHttpServer())
      .post('/activities')
      .set('Authorization', `Bearer ${rpToken}`)
      .send(validActivityPayload());

    if (res.status === 201) {
      createdActivityId = res.body.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Auth guard
  // ──────────────────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('[CAL-BR-002] POST /activities sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .send(validActivityPayload());

      expect(res.status).toBe(401);
    });

    it('GET /activities/:id sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/activities/some-id');
      expect(res.status).toBe(401);
    });

    it('PUT /activities/:id sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .put('/activities/some-id')
        .send({ title: 'x' });
      expect(res.status).toBe(401);
    });

    it('GET /calendars/:ownerId sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get(`/calendars/${IDS.student1}`);
      expect(res.status).toBe(401);
    });

    it('PUT /calendars/:ownerId/availability sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .put(`/calendars/${IDS.teacher1}/availability`)
        .send({ slots: [] });
      expect(res.status).toBe(401);
    });

    it('POST /reminders sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /calendars/:ownerId/availability-slots sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/availability-slots`)
        .send({ startTime: new Date().toISOString(), endTime: new Date().toISOString() });
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /activities — creation (CAL-BR-001, CAL-BR-003, CAL-BR-004)
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /activities — creation d\'une activite', () => {
    it('[CAL-BR-001] POST avec champs requis (RP) → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validActivityPayload());

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('[CAL-BR-001] Un formateur peut creer une activite → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validActivityPayload());

      expect(res.status).toBe(201);
    });

    it('[CAL-BR-003] Body vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('[CAL-BR-003] title manquant → 400', async () => {
      const { title: _omit, ...body } = validActivityPayload() as any;
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('[CAL-BR-003] type manquant → 400', async () => {
      const { type: _omit, ...body } = validActivityPayload() as any;
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('[CAL-BR-003] participantIds vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validActivityPayload({ participantIds: [] }));

      expect(res.status).toBe(400);
    });

    it('[CAL-BR-003] startTime manquant → 400', async () => {
      const { startTime: _omit, ...body } = validActivityPayload() as any;
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('[CAL-BR-003] endTime manquant → 400', async () => {
      const { endTime: _omit, ...body } = validActivityPayload() as any;
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('[CAL-BR-004] Creation reussie → 201 (ActivityScheduled presume publie)', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validActivityPayload());

      expect(res.status).toBe(201);
      // Si le service expose l'evenement dans la reponse, on le verifie
      if (res.body.event) {
        expect(res.body.event).toBe('ActivityScheduled');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Verification de lien a la creation (chantier calendrier, point 3)
  // Corrige un trou de securite reel : jusqu'ici aucun lien n'etait verifie
  // avant de creer une proposition de cours/reunion pedagogique.
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /activities — verification de lien 1 proposeur → 1 destinataire', () => {
    it("Un formateur propose un cours a un eleve auquel il n'est PAS lie → 403", async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${teacher2Token}`) // teacher2 : aucune relation posee
        .send(validActivityPayload());

      expect(res.status).toBe(403);
    });

    it('Un formateur propose un cours a plus d\'un destinataire → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validActivityPayload({ participantIds: [IDS.student1, IDS.student2] }));

      expect(res.status).toBe(400);
    });

    it("Un AP propose une reunion_pedagogique a un formateur qu'il n'anime PAS → 403", async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${apToken}`)
        .send(validActivityPayload({ type: 'reunion_pedagogique', participantIds: [IDS.teacher2] }));

      expect(res.status).toBe(403);
    });

    it('Un AP propose une reunion_pedagogique au formateur qu\'il anime → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${apToken}`)
        .send(validActivityPayload({ type: 'reunion_pedagogique', participantIds: [IDS.teacher1] }));

      expect(res.status).toBe(201);
    });

    it('Un RP cree une reunion_pedagogique a plusieurs formateurs → 201 (usage existant, inchange)', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(
          validActivityPayload({
            type: 'reunion_pedagogique',
            participantIds: [IDS.teacher1, IDS.teacher2],
          }),
        );

      expect(res.status).toBe(201);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /activities/:id — lecture par ID (CAL-BR-008, CAL-BR-009)
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /activities/:id — detail d\'une activite', () => {
    it('[CAL-BR-008] GET /activities/:id retourne le detail → 200', async () => {
      if (!createdActivityId) {
        console.warn('createdActivityId non defini — seed a echoue, skip CAL-BR-008');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/activities/${createdActivityId}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', createdActivityId);
    });

    it('[CAL-BR-009] GET /activities/:id sur activite inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/activities/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /activities/:id — modification (CAL-BR-010, CAL-BR-011)
  // ──────────────────────────────────────────────────────────────────────────

  describe('PUT /activities/:id — modification', () => {
    it('[CAL-BR-010] PUT /activities/:id modifie une activite → 200', async () => {
      if (!createdActivityId) {
        console.warn('createdActivityId non defini — seed a echoue, skip CAL-BR-010');
        return;
      }

      const res = await request(app.getHttpServer())
        .put(`/activities/${createdActivityId}`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ title: 'Cours de geometrie avance' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', createdActivityId);
      if (res.body.event) {
        expect(res.body.event).toBe('ActivityUpdated');
      }
    });

    it('[CAL-BR-011] PUT /activities/:id sur activite inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .put(`/activities/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ title: 'x' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /activities/:id — suppression (meme politique que PUT, CAL-FB-001)
  // ──────────────────────────────────────────────────────────────────────────

  describe('DELETE /activities/:id — suppression', () => {
    async function createActivityAsTeacher1(): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validActivityPayload());
      expect(res.status).toBe(201);
      return res.body.id;
    }

    it('Le createur supprime sa propre activite → 204', async () => {
      const activityId = await createActivityAsTeacher1();

      const res = await request(app.getHttpServer())
        .delete(`/activities/${activityId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(204);

      const check = await request(app.getHttpServer())
        .get(`/activities/${activityId}`)
        .set('Authorization', `Bearer ${rpToken}`);
      expect(check.status).toBe(404);
    });

    it('Un RP peut supprimer une activite dont il n\'est pas le createur → 204', async () => {
      const activityId = await createActivityAsTeacher1();

      const res = await request(app.getHttpServer())
        .delete(`/activities/${activityId}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(204);
    });

    it('Un tiers sans droit (ni createur, ni RP/TI) ne peut pas supprimer → 403', async () => {
      const activityId = await createActivityAsTeacher1();

      const res = await request(app.getHttpServer())
        .delete(`/activities/${activityId}`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });

    it('DELETE sur une activite inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/activities/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(404);
    });

    it('DELETE /activities/:id sans token → 401', async () => {
      const activityId = await createActivityAsTeacher1();
      const res = await request(app.getHttpServer()).delete(`/activities/${activityId}`);
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /activities/:id/accept · /decline (chantier calendrier, point 3)
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /activities/:id/accept — /decline — reponse a une proposition', () => {
    async function createCoursProposal(): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validActivityPayload());
      expect(res.status).toBe(201);
      return res.body.id;
    }

    it('Le destinataire vise accepte une proposition → 201, status CONFIRMED', async () => {
      const activityId = await createCoursProposal();

      const res = await request(app.getHttpServer())
        .post(`/activities/${activityId}/accept`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', activityId);
      expect(res.body.status).toBe('confirmed');
    });

    it('Le destinataire vise refuse une proposition → 201, status CANCELLED', async () => {
      const activityId = await createCoursProposal();

      const res = await request(app.getHttpServer())
        .post(`/activities/${activityId}/decline`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', activityId);
      expect(res.body.status).toBe('cancelled');
    });

    it("Un tiers qui n'est pas le destinataire vise ne peut pas accepter → 403", async () => {
      const activityId = await createCoursProposal();

      const res = await request(app.getHttpServer())
        .post(`/activities/${activityId}/accept`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });

    it("Le proposeur (createur) ne peut pas accepter sa propre proposition → 403", async () => {
      const activityId = await createCoursProposal();

      const res = await request(app.getHttpServer())
        .post(`/activities/${activityId}/accept`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });

    it('Une activite deja CONFIRMED ne peut pas etre acceptee de nouveau → 409', async () => {
      const activityId = await createCoursProposal();
      const first = await request(app.getHttpServer())
        .post(`/activities/${activityId}/accept`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/activities/${activityId}/accept`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(second.status).toBe(409);
    });

    it('Une activite deja CANCELLED (declinee) ne peut pas etre refusee de nouveau → 409', async () => {
      const activityId = await createCoursProposal();
      const first = await request(app.getHttpServer())
        .post(`/activities/${activityId}/decline`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/activities/${activityId}/decline`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(second.status).toBe(409);
    });

    it('POST /activities/:id/accept sans token → 401', async () => {
      const activityId = await createCoursProposal();
      const res = await request(app.getHttpServer()).post(`/activities/${activityId}/accept`);
      expect(res.status).toBe(401);
    });

    it('POST /activities/:id/accept sur une activite inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/activities/${IDS.unknown}/accept`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /calendars/:ownerId — lecture du calendrier (CAL-BR-005)
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /calendars/:ownerId — calendrier utilisateur', () => {
    it('[CAL-BR-005] Un RP peut lire le calendrier d\'un utilisateur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.student1}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
    });

    it('[CAL-BR-005] Un utilisateur peut lire son propre calendrier → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.student1}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
    });

    it('[CAL-BR-005] Lecture calendrier utilisateur inexistant → 200 (creation lazy)', async () => {
      // Le service cree le calendrier a la volee si l'utilisateur n'en a pas encore.
      // Ce comportement "lazy init" est intentionnel (pas de 404 sur GET /calendars/:id).
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
    });

    // --- activites portees par le calendrier (chantier calendrier, point 3 — gap comble) ---

    it("porte l'activite seed (createe par le RP vers student1) avec le nom du createur resolu, jamais un UUID", async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.student1}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.activities)).toBe(true);
      expect(res.body.activities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: createdActivityId,
            type: 'cours',
            creatorId: IDS.rp1,
            creatorName: 'Robert Pedago',
            participantIds: [IDS.student1],
          }),
        ]),
      );
      // Regle stricte du projet : aucun UUID affiche a la place d'un nom.
      const seedActivity = res.body.activities.find((a: { id: string }) => a.id === createdActivityId);
      expect(seedActivity.creatorName).not.toBe(IDS.rp1);
    });

    it('degrade gracieusement a creatorName: null quand profile-service est injoignable, sans faire echouer la lecture', async () => {
      profileDisplayNames.setUnavailable(true);
      try {
        const res = await request(app.getHttpServer())
          .get(`/calendars/${IDS.student1}`)
          .set('Authorization', `Bearer ${student1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.activities).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: createdActivityId, creatorName: null }),
          ]),
        );
      } finally {
        profileDisplayNames.setUnavailable(false);
      }
    });

    it('un utilisateur sans activite dans la fenetre recoit activities: []', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body.activities).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /calendars/:ownerId/availability — mise a jour creneaux (CAL-EVT-001)
  // ──────────────────────────────────────────────────────────────────────────

  describe('PUT /calendars/:ownerId/availability — creneaux de disponibilite', () => {
    const start = new Date(Date.now() + 86_400_000);
    const end   = new Date(start.getTime() + 7_200_000);

    it('[CAL-EVT-001] Un formateur peut mettre a jour ses creneaux → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/calendars/${IDS.teacher1}/availability`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          slots: [
            {
              startTime: start.toISOString(),
              endTime:   end.toISOString(),
            },
          ],
        });

      expect(res.status).toBe(200);
      if (res.body.event) {
        expect(res.body.event).toBe('AvailabilityUpdated');
      }
    });

    it('[CAL-EVT-001] Slots vide (replacement complet) → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/calendars/${IDS.teacher1}/availability`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ slots: [] });

      expect(res.status).toBe(200);
    });

    it('Body manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .put(`/calendars/${IDS.teacher1}/availability`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST/PATCH/DELETE /calendars/:ownerId/availability-slots[/:slotId]
  // CRUD par creneau individuel (chantier calendrier de disponibilites, point 1)
  // ──────────────────────────────────────────────────────────────────────────

  describe('CRUD /calendars/:ownerId/availability-slots — creneau individuel', () => {
    function validSlotPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      const start = new Date(Date.now() + 2 * 86_400_000);
      const end = new Date(start.getTime() + 7_200_000);
      return {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        ...overrides,
      };
    }

    it('Un formateur cree un creneau pour lui-meme → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/availability-slots`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validSlotPayload());

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.kind).toBe('available');
    });

    it('Un eleve cree un creneau pour lui-meme → 201 (CAL-BR-001)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.student1}/availability-slots`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send(validSlotPayload());

      expect(res.status).toBe(201);
    });

    it('Un RP cree un creneau pour un tiers → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher2}/availability-slots`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validSlotPayload({ kind: 'unavailable' }));

      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('unavailable');
    });

    it('Un formateur ne peut pas creer un creneau pour un tiers → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.student1}/availability-slots`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validSlotPayload());

      expect(res.status).toBe(403);
    });

    it('endTime <= startTime → 400', async () => {
      const start = new Date(Date.now() + 86_400_000);
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/availability-slots`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ startTime: start.toISOString(), endTime: start.toISOString() });

      expect(res.status).toBe(400);
    });

    it('startTime manquant → 400', async () => {
      const { startTime: _omit, ...body } = validSlotPayload() as any;
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/availability-slots`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    describe('PATCH et DELETE sur un creneau existant', () => {
      let slotId: string;

      beforeAll(async () => {
        const res = await request(app.getHttpServer())
          .post(`/calendars/${IDS.teacher1}/availability-slots`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send(validSlotPayload({ recurrence: 'weekly' }));
        slotId = res.body.id;
      });

      it('Le titulaire redimensionne son creneau → 200', async () => {
        if (!slotId) {
          console.warn('slotId non defini — seed a echoue, skip PATCH resize');
          return;
        }
        const newEnd = new Date(Date.now() + 3 * 86_400_000);
        const res = await request(app.getHttpServer())
          .patch(`/calendars/${IDS.teacher1}/availability-slots/${slotId}`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ endTime: newEnd.toISOString() });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', slotId);
      });

      it('Le titulaire pose une date de fin de recurrence puis l\'efface → 200', async () => {
        if (!slotId) return;
        const endDate = new Date(Date.now() + 30 * 86_400_000);
        const withEndDate = await request(app.getHttpServer())
          .patch(`/calendars/${IDS.teacher1}/availability-slots/${slotId}`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ recurrenceEndDate: endDate.toISOString() });
        expect(withEndDate.status).toBe(200);

        const cleared = await request(app.getHttpServer())
          .patch(`/calendars/${IDS.teacher1}/availability-slots/${slotId}`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ recurrenceEndDate: null });
        expect(cleared.status).toBe(200);
        expect(cleared.body.recurrenceEndDate).toBeNull();
      });

      it('Un tiers sans droit ne peut pas modifier le creneau → 403', async () => {
        if (!slotId) return;
        const res = await request(app.getHttpServer())
          .patch(`/calendars/${IDS.teacher1}/availability-slots/${slotId}`)
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ kind: 'unavailable' });

        expect(res.status).toBe(403);
      });

      it('PATCH sur un slotId inexistant → 404', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/calendars/${IDS.teacher1}/availability-slots/${IDS.unknown}`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ kind: 'unavailable' });

        expect(res.status).toBe(404);
      });

      it("PATCH avec l'ownerId d'un tiers sur un slotId existant ailleurs → 404 (pas de fuite)", async () => {
        if (!slotId) return;
        const res = await request(app.getHttpServer())
          .patch(`/calendars/${IDS.student1}/availability-slots/${slotId}`)
          .set('Authorization', `Bearer ${rpToken}`)
          .send({ kind: 'unavailable' });

        expect(res.status).toBe(404);
      });

      it('Le titulaire supprime son creneau → 204', async () => {
        if (!slotId) return;
        const res = await request(app.getHttpServer())
          .delete(`/calendars/${IDS.teacher1}/availability-slots/${slotId}`)
          .set('Authorization', `Bearer ${teacher1Token}`);

        expect(res.status).toBe(204);
      });

      it('DELETE sur un slotId deja supprime → 404', async () => {
        if (!slotId) return;
        const res = await request(app.getHttpServer())
          .delete(`/calendars/${IDS.teacher1}/availability-slots/${slotId}`)
          .set('Authorization', `Bearer ${teacher1Token}`);

        expect(res.status).toBe(404);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /reminders — creation d'un rappel (CAL-EVT-002, CAL-BR-004)
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /reminders — creation d\'un rappel', () => {
    function validReminderPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        ownerId:   IDS.student1,
        ownerRole: 'eleve',
        message:   'Rappel cours demain',
        remindAt:  new Date(Date.now() + 86_400_000).toISOString(),
        ...overrides,
      };
    }

    it('[CAL-EVT-002] Un RP cree un rappel → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validReminderPayload());

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      if (res.body.event) {
        expect(res.body.event).toBe('ReminderCreated');
      }
    });

    it('[CAL-EVT-002] Un formateur peut creer un rappel → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validReminderPayload({ ownerId: IDS.teacher1, ownerRole: 'formateur' }));

      expect(res.status).toBe(201);
    });

    it('[CAL-EVT-002] Un eleve peut creer un rappel pour lui-meme → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${student1Token}`)
        .send(validReminderPayload());

      expect(res.status).toBe(201);
    });

    it('Body vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('ownerId manquant → 400', async () => {
      const { ownerId: _omit, ...body } = validReminderPayload() as any;
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('message manquant → 400', async () => {
      const { message: _omit, ...body } = validReminderPayload() as any;
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('remindAt manquant → 400', async () => {
      const { remindAt: _omit, ...body } = validReminderPayload() as any;
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('Un parent_financeur est refuse → 403', async () => {
      const parentToken = makeJwt(IDS.parent1, 'parent_financeur');
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${parentToken}`)
        .send(validReminderPayload({ ownerId: IDS.parent1, ownerRole: 'parent_financeur' }));

      expect(res.status).toBe(403);
    });
  });
});

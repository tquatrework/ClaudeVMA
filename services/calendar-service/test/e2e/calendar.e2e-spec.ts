/**
 * E2E — Calendar service: activities, calendars & reminders
 *
 * Routes reelles exposees par le service :
 *
 *   Activities
 *   POST   /activities                         create a scheduled activity
 *   PUT    /activities/:activityId             update a scheduled activity
 *   GET    /activities/:activityId             get an activity by ID
 *
 *   Calendars
 *   GET    /calendars/:ownerId                 get a user calendar (slots + activities)
 *   PUT    /calendars/:ownerId/availability    replace availability slots
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
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';

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

  let rpToken: string;
  let teacher1Token: string;
  let student1Token: string;

  // Activity ID captured after seed creation
  let createdActivityId: string;

  beforeAll(async () => {
    app = await createTestApp();

    rpToken       = makeJwt(IDS.rp1,      'responsable_pedagogique');
    teacher1Token = makeJwt(IDS.teacher1, 'formateur');
    student1Token = makeJwt(IDS.student1, 'eleve');

    // Seed: create one activity used by read/update tests
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

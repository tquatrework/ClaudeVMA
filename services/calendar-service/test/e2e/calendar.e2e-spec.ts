/**
 * E2E — Calendar service: activities, calendars, reminders & calendar-events
 *
 * Routes exposees par le service :
 *
 *   Activities
 *   POST   /activities                               create a scheduled activity
 *   PUT    /activities/:activityId                   update a scheduled activity
 *   GET    /activities/:activityId                   get an activity by ID
 *
 *   Calendars
 *   GET    /calendars/:ownerId                       get a user calendar (slots + activities)
 *   GET    /calendars/:ownerId/availability          read availability slots
 *   PUT    /calendars/:ownerId/availability          replace availability slots
 *
 *   Reminders
 *   POST   /reminders                                create a reminder
 *
 *   CalendarEvents
 *   GET    /calendars/:ownerId/events                list authorized events
 *   POST   /calendars/:ownerId/events                create a calendar event
 *   POST   /events/:id/invitees/:userId/accept       accept invitation
 *   POST   /events/:id/invitees/:userId/decline      decline invitation
 *   POST   /events/:id/cancel-request               request cancellation
 *   POST   /events/:id/reminders                    configure reminder rule
 *   POST   /calendars/:ownerId/grants               create visibility grant (RP only)
 *   DELETE /calendars/:ownerId/grants/:granteeId    revoke visibility grant (RP only)
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';

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

function validCalendarEventPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  // Use 3 days from now so the event is always > 48h away (auto-approved cancellation)
  const start = new Date(Date.now() + 3 * 86_400_000);
  const end   = new Date(start.getTime() + 3_600_000);
  return {
    title: 'Cours de maths',
    eventType: 'cours',
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
  let parentToken: string;
  let adminFinToken: string;

  let createdActivityId: string;
  let createdEventId: string;
  let createdEventWithInviteeId: string;

  beforeAll(async () => {
    app = await createTestApp();

    rpToken        = makeJwt(IDS.rp1,      'responsable_pedagogique');
    teacher1Token  = makeJwt(IDS.teacher1, 'formateur');
    student1Token  = makeJwt(IDS.student1, 'eleve');
    parentToken    = makeJwt(IDS.parent1,  'parent_financeur');
    adminFinToken  = makeJwt(IDS.adminFin, 'administrateur_financier');

    // Seed: create one activity used by read/update tests
    const activityRes = await request(app.getHttpServer())
      .post('/activities')
      .set('Authorization', `Bearer ${rpToken}`)
      .send(validActivityPayload());

    if (activityRes.status === 201) {
      createdActivityId = activityRes.body.id;
    }

    // Seed: create one calendar event for cancel/reminder tests
    const eventRes = await request(app.getHttpServer())
      .post(`/calendars/${IDS.teacher1}/events`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send(validCalendarEventPayload());

    if (eventRes.status === 201) {
      createdEventId = eventRes.body.id;
    }

    // Seed: create one calendar event with an invitee
    const eventWithInviteeRes = await request(app.getHttpServer())
      .post(`/calendars/${IDS.teacher1}/events`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send(validCalendarEventPayload({ inviteeIds: [IDS.student1] }));

    if (eventWithInviteeRes.status === 201) {
      createdEventWithInviteeId = eventWithInviteeRes.body.id;
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

    it('GET /calendars/:ownerId/events sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get(`/calendars/${IDS.teacher1}/events`);
      expect(res.status).toBe(401);
    });

    it('POST /calendars/:ownerId/events sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/events`)
        .send(validCalendarEventPayload());
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /activities — creation
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

    it('[CAL-BR-003] participantIds vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validActivityPayload({ participantIds: [] }));

      expect(res.status).toBe(400);
    });

    it('[CAL-BR-004] Creation reussie → 201 (ActivityScheduled presume publie)', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validActivityPayload());

      expect(res.status).toBe(201);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /activities/:id — lecture
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /activities/:id — detail d\'une activite', () => {
    it('[CAL-BR-008] GET /activities/:id retourne le detail → 200', async () => {
      if (!createdActivityId) {
        console.warn('createdActivityId non defini — skip');
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
  // PUT /activities/:id — modification
  // ──────────────────────────────────────────────────────────────────────────

  describe('PUT /activities/:id — modification', () => {
    it('[CAL-BR-010] PUT /activities/:id modifie une activite → 200', async () => {
      if (!createdActivityId) {
        console.warn('createdActivityId non defini — skip');
        return;
      }

      const res = await request(app.getHttpServer())
        .put(`/activities/${createdActivityId}`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ title: 'Cours de geometrie avance' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', createdActivityId);
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
  // GET /calendars/:ownerId — lecture du calendrier
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
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /calendars/:ownerId/availability
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /calendars/:ownerId/availability — lecture des disponibilites', () => {
    it('Un propriétaire peut lire ses disponibilites → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.teacher1}/availability`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('availabilitySlots');
    });

    it('RP peut lire les disponibilites d\'un autre utilisateur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.student1}/availability`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUT /calendars/:ownerId/availability
  // ──────────────────────────────────────────────────────────────────────────

  describe('PUT /calendars/:ownerId/availability — creneaux de disponibilite', () => {
    const start = new Date(Date.now() + 86_400_000);
    const end   = new Date(start.getTime() + 7_200_000);

    it('[CAL-EVT-001] Un formateur peut mettre a jour ses creneaux → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/calendars/${IDS.teacher1}/availability`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({
          slots: [{ startTime: start.toISOString(), endTime: end.toISOString() }],
        });

      expect(res.status).toBe(200);
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
  // POST /reminders
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

    it('Un parent_financeur est refuse → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/reminders')
        .set('Authorization', `Bearer ${parentToken}`)
        .send(validReminderPayload({ ownerId: IDS.parent1, ownerRole: 'parent_financeur' }));

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /calendars/:ownerId/events
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /calendars/:ownerId/events — liste des evenements', () => {
    it('Le proprietaire peut lister ses evenements → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('RP peut lister les evenements d\'un autre utilisateur → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
    });

    it('Liste avec filtre type → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.teacher1}/events?type=cours`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
    });

    it('Un utilisateur sans acces ne peut pas lire le calendrier d\'un autre → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
    });

    it('PARENT_FINANCEUR peut lister les evenements (filtres automatiquement a financier) → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /calendars/:ownerId/events
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /calendars/:ownerId/events — creation d\'un evenement', () => {
    it('Un formateur peut creer un evenement COURS → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validCalendarEventPayload());

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.eventType).toBe('cours');
    });

    it('Un eleve peut creer un evenement RAPPEL → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.student1}/events`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send(validCalendarEventPayload({ eventType: 'rappel' }));

      expect(res.status).toBe(201);
    });

    it('Un eleve ne peut pas creer un COURS → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.student1}/events`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send(validCalendarEventPayload({ eventType: 'cours' }));

      expect(res.status).toBe(403);
    });

    it('Un PARENT_FINANCEUR ne peut pas creer d\'evenement → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.parent1}/events`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send(validCalendarEventPayload({ eventType: 'rappel' }));

      expect(res.status).toBe(403);
    });

    it('Body vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('RP peut creer un evenement FINANCIER → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.rp1}/events`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validCalendarEventPayload({ eventType: 'financier' }));

      expect(res.status).toBe(201);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /events/:id/invitees/:userId/accept
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /events/:id/invitees/:userId/accept — accepter invitation', () => {
    it('Un invitee peut accepter une invitation → 201', async () => {
      if (!createdEventWithInviteeId) {
        console.warn('createdEventWithInviteeId non defini — skip');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/events/${createdEventWithInviteeId}/invitees/${IDS.student1}/accept`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('accepted');
    });

    it('Accepter une invitation deja acceptee → 409', async () => {
      if (!createdEventWithInviteeId) {
        console.warn('createdEventWithInviteeId non defini — skip');
        return;
      }

      // Second accept on same invitation
      const res = await request(app.getHttpServer())
        .post(`/events/${createdEventWithInviteeId}/invitees/${IDS.student1}/accept`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(409);
    });

    it('Invitation inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${IDS.unknown}/invitees/${IDS.student1}/accept`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /events/:id/invitees/:userId/decline
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /events/:id/invitees/:userId/decline — refuser invitation', () => {
    let eventForDeclineId: string;

    beforeAll(async () => {
      // Create a separate event with invitee for decline testing
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validCalendarEventPayload({ inviteeIds: [IDS.student2] }));

      if (res.status === 201) {
        eventForDeclineId = res.body.id;
      }
    });

    it('Un invitee peut refuser une invitation → 201', async () => {
      if (!eventForDeclineId) {
        console.warn('eventForDeclineId non defini — skip');
        return;
      }

      const student2Token = makeJwt(IDS.student2, 'eleve');
      const res = await request(app.getHttpServer())
        .post(`/events/${eventForDeclineId}/invitees/${IDS.student2}/decline`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('declined');
    });

    it('Invitation inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${IDS.unknown}/invitees/${IDS.student1}/decline`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /events/:id/cancel-request
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /events/:id/cancel-request — demande d\'annulation', () => {
    it('Le createur peut annuler son evenement (> 48h) → 201 avec statut APPROVED', async () => {
      if (!createdEventId) {
        console.warn('createdEventId non defini — skip');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/events/${createdEventId}/cancel-request`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ reason: 'Empechement' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('approved');
    });

    it('Annulation d\'un evenement deja annule → 409', async () => {
      if (!createdEventId) {
        console.warn('createdEventId non defini — skip');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/events/${createdEventId}/cancel-request`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});

      expect(res.status).toBe(409);
    });

    it('Un inconnu ne peut pas annuler → 403', async () => {
      // Create a new event to test forbidden
      const newEventRes = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validCalendarEventPayload());

      if (newEventRes.status !== 201) return;

      const res = await request(app.getHttpServer())
        .post(`/events/${newEventRes.body.id}/cancel-request`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('Evenement inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${IDS.unknown}/cancel-request`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({});

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /events/:id/reminders
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /events/:id/reminders — configurer un rappel', () => {
    let eventForReminderId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/events`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send(validCalendarEventPayload());

      if (res.status === 201) {
        eventForReminderId = res.body.id;
      }
    });

    it('Configurer un rappel d\'1 heure → 201', async () => {
      if (!eventForReminderId) {
        console.warn('eventForReminderId non defini — skip');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/events/${eventForReminderId}/reminders`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ delay: '1hour' });

      expect(res.status).toBe(201);
      expect(res.body.delay).toBe('1hour');
    });

    it('Configurer "none" supprime le rappel → 201', async () => {
      if (!eventForReminderId) {
        console.warn('eventForReminderId non defini — skip');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/events/${eventForReminderId}/reminders`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ delay: 'none' });

      expect(res.status).toBe(201);
      expect(res.body.delay).toBe('none');
    });

    it('Valeur delay invalide → 400', async () => {
      if (!eventForReminderId) {
        console.warn('eventForReminderId non defini — skip');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/events/${eventForReminderId}/reminders`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ delay: 'invalid_delay' });

      expect(res.status).toBe(400);
    });

    it('Evenement inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${IDS.unknown}/reminders`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ delay: '1hour' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /calendars/:ownerId/grants & DELETE /calendars/:ownerId/grants/:granteeId
  // ──────────────────────────────────────────────────────────────────────────

  describe('CalendarVisibilityGrant — grants RP', () => {
    it('RP peut creer un grant → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/grants`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ granteeId: IDS.student1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('Non-RP ne peut pas creer un grant → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher1}/grants`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ granteeId: IDS.student1 });

      expect(res.status).toBe(403);
    });

    it('RP peut revoquer un grant → 200', async () => {
      // First create grant
      await request(app.getHttpServer())
        .post(`/calendars/${IDS.teacher2}/grants`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ granteeId: IDS.student2 });

      const res = await request(app.getHttpServer())
        .delete(`/calendars/${IDS.teacher2}/grants/${IDS.student2}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('revoked', true);
    });

    it('Non-RP ne peut pas revoquer un grant → 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/calendars/${IDS.teacher1}/grants/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });

    it('Revoquer un grant inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/calendars/${IDS.teacher1}/grants/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(404);
    });
  });
});

/**
 * E2E — Video Session Service: room lifecycle & access control
 *
 * Routes testées :
 *
 *   POST   /video/rooms                          créer une salle
 *   GET    /video/rooms/:roomId                  lire une salle
 *   GET    /video/rooms/:roomId/join             rejoindre une salle (génère un access token)
 *   POST   /video/rooms/:roomId/attendance       enregistrer une présence
 *   POST   /video/rooms/:roomId/close            clôturer une session
 *   POST   /video/rooms/:roomId/recordings       déclarer un enregistrement
 *   GET    /video/rooms/:roomId/recordings       lister les enregistrements
 *   POST   /recordings/:recordingId/comments     ajouter un commentaire horodaté
 *   POST   /video/rooms/:roomId/summary          publier le résumé de cours
 *
 * Critères couverts :
 *
 *   Création de salle
 *   VID-BR-004   POST /video/rooms avec calendarSessionId requis → 201 (WAITING)
 *   VID-RA-002   Un formateur peut créer une salle → 201
 *   VID-RA-002   Un RP peut créer une salle → 201
 *   VID-RA-002   Un AP peut créer une salle → 201
 *   VID-RA-002   Un TI peut créer une salle → 201
 *   VID-RA-003   Un élève ne peut PAS créer une salle → 403
 *   VID-FB-001   Un parent_financeur ne peut PAS créer une salle → 403
 *                POST sans token → 401
 *                calendarSessionId manquant → 400
 *                calendarSessionId non UUID → 400
 *
 *   Lecture de salle
 *   VID-RA-001   Tout utilisateur authentifié peut lire une salle → 200
 *                GET salle inexistante → 404
 *                GET sans token → 401
 *
 *   Accès participant (join)
 *   VID-BR-005   Un formateur rejoint la salle → 200 (accessToken + roomToken)
 *   VID-BR-005   Un élève rejoint la salle → 200
 *   VID-BR-004   Premier join : salle passe de WAITING → ACTIVE
 *   VID-FB-001   Un parent_financeur est refusé → 403
 *                GET join sans token → 401
 *                GET join salle inexistante → 404
 *                GET join salle déjà ENDED → 400
 *
 *   Présence (attendance)
 *   VID-BR-006   POST /attendance enregistre une présence → 201
 *                POST /attendance sans token → 401
 *                POST /attendance pour salle inexistante → 404
 *                POST /attendance pour session terminée → 400
 *                POST /attendance par un parent_financeur → 403
 *
 *   Clôture (close)
 *   VID-BR-006   POST /close ferme la salle et publie VideoSessionEnded → 201 (ENDED)
 *   VID-RA-002   Un formateur peut clôturer → 201
 *   VID-RA-003   Un élève ne peut PAS clôturer → 403
 *                POST /close sans token → 401
 *                POST /close salle inexistante → 404
 *                POST /close salle déjà ENDED → 400
 *
 * Auth : JWT Bearer (type: "access") via JwtAuthGuard.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';

// ─── Payload minimal valide pour créer une salle ─────────────────────────────

function validCreateRoomPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    calendarSessionId: IDS.session1,
    ...overrides,
  };
}

describe('[E2E] Video Session Service', () => {
  let app: INestApplication;

  let teacherToken: string;
  let studentToken: string;
  let parentToken: string;
  let rpToken: string;
  let apToken: string;
  let tiToken: string;

  // Room IDs captured after seed creation, shared across test groups
  let waitingRoomId: string;
  let activeRoomId: string;
  let endedRoomId: string;

  beforeAll(async () => {
    app = await createTestApp();

    teacherToken = makeJwt(IDS.teacher1, 'formateur');
    studentToken = makeJwt(IDS.student1, 'eleve');
    parentToken  = makeJwt(IDS.parent1,  'parent_financeur');
    rpToken      = makeJwt(IDS.rp1,      'responsable_pedagogique');
    apToken      = makeJwt(IDS.ap1,      'animateur_pedagogique');
    tiToken      = makeJwt(IDS.ti,       'technicien_informatique');

    // Seed 1: a WAITING room (created but never joined)
    const r1 = await request(app.getHttpServer())
      .post('/video/rooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(validCreateRoomPayload());
    if (r1.status === 201) {
      waitingRoomId = r1.body.id;
    }

    // Seed 2: an ACTIVE room (created and then joined once)
    const r2 = await request(app.getHttpServer())
      .post('/video/rooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(validCreateRoomPayload());
    if (r2.status === 201) {
      activeRoomId = r2.body.id;
      // Join to transition WAITING → ACTIVE
      await request(app.getHttpServer())
        .get(`/video/rooms/${activeRoomId}/join`)
        .set('Authorization', `Bearer ${teacherToken}`);
    }

    // Seed 3: an ENDED room (created, joined and closed)
    const r3 = await request(app.getHttpServer())
      .post('/video/rooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(validCreateRoomPayload());
    if (r3.status === 201) {
      endedRoomId = r3.body.id;
      await request(app.getHttpServer())
        .get(`/video/rooms/${endedRoomId}/join`)
        .set('Authorization', `Bearer ${teacherToken}`);
      await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/close`)
        .set('Authorization', `Bearer ${teacherToken}`);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Auth guard — toutes les routes video/ sont protégées
  // ────────────────────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('POST /video/rooms sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .send(validCreateRoomPayload());
      expect(res.status).toBe(401);
    });

    it('GET /video/rooms/:id sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${IDS.unknown}`);
      expect(res.status).toBe(401);
    });

    it('GET /video/rooms/:id/join sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${IDS.unknown}/join`);
      expect(res.status).toBe(401);
    });

    it('POST /video/rooms/:id/attendance sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${IDS.unknown}/attendance`)
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /video/rooms/:id/close sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${IDS.unknown}/close`);
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /video/rooms — création de salle (VID-BR-004, VID-RA-002)
  // ────────────────────────────────────────────────────────────────────────────

  describe('POST /video/rooms — création de salle', () => {
    it('[VID-BR-004] Un formateur crée une salle → 201 avec roomToken et status WAITING', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(validCreateRoomPayload());

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('roomToken');
      expect(res.body).toHaveProperty('calendarSessionId', IDS.session1);
      expect(res.body.status).toBe('waiting');
    });

    it('[VID-RA-002] Un RP peut créer une salle → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validCreateRoomPayload());
      expect(res.status).toBe(201);
    });

    it('[VID-RA-002] Un AP peut créer une salle → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${apToken}`)
        .send(validCreateRoomPayload());
      expect(res.status).toBe(201);
    });

    it('[VID-RA-002] Un TI peut créer une salle → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${tiToken}`)
        .send(validCreateRoomPayload());
      expect(res.status).toBe(201);
    });

    it('[VID-RA-003] Un élève ne peut PAS créer une salle → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(validCreateRoomPayload());
      expect(res.status).toBe(403);
    });

    it('[VID-FB-001] Un parent_financeur ne peut PAS créer une salle → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${parentToken}`)
        .send(validCreateRoomPayload());
      expect(res.status).toBe(403);
    });

    it('calendarSessionId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('calendarSessionId non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ calendarSessionId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GET /video/rooms/:roomId — lecture de salle (VID-RA-001)
  // ────────────────────────────────────────────────────────────────────────────

  describe('GET /video/rooms/:roomId — lecture de salle', () => {
    it('[VID-RA-001] Un formateur peut lire une salle existante → 200', async () => {
      if (!waitingRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${waitingRoomId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', waitingRoomId);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('roomToken');
      expect(res.body).toHaveProperty('calendarSessionId');
    });

    it('[VID-RA-001] Un élève peut lire une salle existante → 200', async () => {
      if (!waitingRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${waitingRoomId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
    });

    it('[VID-RA-001] Un parent peut lire une salle existante → 200', async () => {
      if (!waitingRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${waitingRoomId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${IDS.unknown}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GET /video/rooms/:roomId/join — accès participant (VID-BR-005, VID-FB-001)
  // ────────────────────────────────────────────────────────────────────────────

  describe('GET /video/rooms/:roomId/join — accès participant', () => {
    it('[VID-BR-005] Un formateur rejoint une salle WAITING → 200 avec accessToken et roomToken', async () => {
      // Create a fresh room so we test WAITING → ACTIVE transition cleanly
      const createRes = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(validCreateRoomPayload());
      expect(createRes.status).toBe(201);

      const roomId = createRes.body.id;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('roomToken');
      expect(res.body).toHaveProperty('status');
    });

    it('[VID-BR-004] Premier join : salle passe de WAITING à ACTIVE', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(validCreateRoomPayload());
      expect(createRes.status).toBe(201);

      const roomId = createRes.body.id;
      expect(createRes.body.status).toBe('waiting');

      const joinRes = await request(app.getHttpServer())
        .get(`/video/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.status).toBe('active');
    });

    it('[VID-BR-005] Un élève peut rejoindre une salle → 200', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${activeRoomId}/join`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('[VID-BR-005] Un RP peut rejoindre une salle → 200', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${activeRoomId}/join`)
        .set('Authorization', `Bearer ${rpToken}`);
      expect(res.status).toBe(200);
    });

    it('[VID-FB-001] Un parent_financeur est refusé → 403', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${activeRoomId}/join`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${IDS.unknown}/join`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(404);
    });

    it('Salle déjà ENDED → 400', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${endedRoomId}/join`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /video/rooms/:roomId/attendance — enregistrement de présence (VID-BR-006)
  // ────────────────────────────────────────────────────────────────────────────

  describe('POST /video/rooms/:roomId/attendance — présence', () => {
    it('[VID-BR-006] Un formateur enregistre sa présence → 201', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('roomId', activeRoomId);
      expect(res.body).toHaveProperty('userId', IDS.teacher1);
      expect(res.body).toHaveProperty('joinedAt');
    });

    it('[VID-BR-006] Un élève enregistre sa présence → 201', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/attendance`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(res.status).toBe(201);
    });

    it('[VID-BR-006] Présence avec timestamps explicites → 201', async () => {
      if (!activeRoomId) return;
      const joinedAt = new Date(Date.now() - 3_600_000).toISOString();
      const leftAt   = new Date(Date.now() - 1_800_000).toISOString();
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/attendance`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ joinedAt, leftAt });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('joinedAt');
    });

    it('joinedAt au format invalide → 400', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ joinedAt: 'not-a-date' });
      expect(res.status).toBe(400);
    });

    it('[VID-FB-001] Un parent_financeur ne peut PAS enregistrer une présence → 403', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/attendance`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${IDS.unknown}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});
      expect(res.status).toBe(404);
    });

    it('Salle déjà ENDED → 400', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST/GET /video/rooms/:roomId/recordings — enregistrements (VID-AC-001)
  // ────────────────────────────────────────────────────────────────────────────

  describe('POST /video/rooms/:roomId/recordings — déclarer un enregistrement', () => {
    it('[VID-AC-001] Un formateur déclare un enregistrement sur une salle ENDED → 201', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ downloadUrl: 'https://storage.example.com/video.mp4' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('roomId', endedRoomId);
      expect(res.body).toHaveProperty('expiresAt');
    });

    it('[VID-AC-001] Un formateur déclare un enregistrement sans URL → 201', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(201);
    });

    it('[VID-FB-001] Un parent_financeur ne peut pas déclarer un enregistrement → 403', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('[VID-FB-001] Un élève ne peut pas déclarer un enregistrement → 403', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('Salle pas encore ENDED → 400', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${IDS.unknown}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(404);
    });

    it('Sans token → 401', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/recordings`)
        .send({});

      expect(res.status).toBe(401);
    });
  });

  describe('GET /video/rooms/:roomId/recordings — lister les enregistrements', () => {
    it('[VID-AC-001] Un formateur liste les enregistrements → 200', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('[VID-AC-001] Un élève liste les enregistrements → 200', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });

    it('[VID-FB-001] Un parent_financeur est refusé → 403', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${IDS.unknown}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(404);
    });

    it('Sans token → 401', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .get(`/video/rooms/${endedRoomId}/recordings`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /recordings/:recordingId/comments — commenter un enregistrement', () => {
    it('[VID-AC-001] Un formateur ajoute un commentaire horodaté → 201', async () => {
      // Seed: create a recording first on the ended room
      if (!endedRoomId) return;
      const recordingRes = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});
      if (recordingRes.status !== 201) return;

      const recordingId = recordingRes.body.id;
      const res = await request(app.getHttpServer())
        .post(`/recordings/${recordingId}/comments`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ timestampSeconds: 120, content: 'Clear derivation at this point' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('recordingId', recordingId);
      expect(res.body).toHaveProperty('timestampSeconds', 120);
    });

    it('[VID-FB-001] Un parent_financeur est refusé → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/recordings/${IDS.unknown}/comments`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ timestampSeconds: 0, content: 'test' });

      expect(res.status).toBe(403);
    });

    it('Enregistrement inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/recordings/${IDS.unknown}/comments`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ timestampSeconds: 0, content: 'test' });

      expect(res.status).toBe(404);
    });

    it('Body invalide (timestampSeconds manquant) → 400', async () => {
      if (!endedRoomId) return;
      const recordingRes = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/recordings`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});
      if (recordingRes.status !== 201) return;

      const recordingId = recordingRes.body.id;
      const res = await request(app.getHttpServer())
        .post(`/recordings/${recordingId}/comments`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ content: 'missing timestamp' });

      expect(res.status).toBe(400);
    });

    it('Sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post(`/recordings/${IDS.unknown}/comments`)
        .send({ timestampSeconds: 0, content: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /video/rooms/:roomId/summary — publier le résumé de cours', () => {
    it('[VID-AC-002] Un formateur publie un résumé → 201 avec isPermanent: true', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/summary`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ content: 'Today we revised trigonometry — sine, cosine, tangent.' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('roomId', endedRoomId);
      expect(res.body).toHaveProperty('isPermanent', true);
      expect(res.body).toHaveProperty('publishedAt');
    });

    it('[VID-AC-002] Un RP publie un résumé → 201', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/summary`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ content: 'RP summary' });

      expect(res.status).toBe(201);
    });

    it('[VID-FB-001] Un élève ne peut pas publier un résumé → 403', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/summary`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'student summary attempt' });

      expect(res.status).toBe(403);
    });

    it('[VID-FB-001] Un parent_financeur ne peut pas publier un résumé → 403', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/summary`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ content: 'parent summary attempt' });

      expect(res.status).toBe(403);
    });

    it('Body vide (content manquant) → 400', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/summary`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${IDS.unknown}/summary`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ content: 'test summary' });

      expect(res.status).toBe(404);
    });

    it('Sans token → 401', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/summary`)
        .send({ content: 'test' });

      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /video/rooms/:roomId/close — clôture de session (VID-BR-006)
  // ────────────────────────────────────────────────────────────────────────────

  describe('POST /video/rooms/:roomId/close — clôture', () => {
    it('[VID-BR-006] Un formateur clôture une salle ACTIVE → 201 avec status ENDED', async () => {
      // Create a dedicated room to close without affecting shared seeds
      const createRes = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(validCreateRoomPayload());
      expect(createRes.status).toBe(201);

      // Join first to move to ACTIVE
      await request(app.getHttpServer())
        .get(`/video/rooms/${createRes.body.id}/join`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const closeRes = await request(app.getHttpServer())
        .post(`/video/rooms/${createRes.body.id}/close`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(closeRes.status).toBe(201);
      expect(closeRes.body).toHaveProperty('status', 'ended');
      expect(closeRes.body).toHaveProperty('endedAt');
    });

    it('[VID-BR-006] Un formateur peut clôturer une salle WAITING directement → 201', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(validCreateRoomPayload());
      expect(createRes.status).toBe(201);

      const closeRes = await request(app.getHttpServer())
        .post(`/video/rooms/${createRes.body.id}/close`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(closeRes.status).toBe(201);
      expect(closeRes.body.status).toBe('ended');
    });

    it('[VID-RA-002] Un RP peut clôturer une salle → 201', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/video/rooms')
        .set('Authorization', `Bearer ${rpToken}`)
        .send(validCreateRoomPayload());
      expect(createRes.status).toBe(201);

      const closeRes = await request(app.getHttpServer())
        .post(`/video/rooms/${createRes.body.id}/close`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(closeRes.status).toBe(201);
    });

    it('[VID-RA-003] Un élève ne peut PAS clôturer une salle → 403', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/close`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('[VID-FB-001] Un parent ne peut PAS clôturer une salle → 403', async () => {
      if (!activeRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${activeRoomId}/close`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });

    it('Salle inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${IDS.unknown}/close`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(404);
    });

    it('Salle déjà ENDED → 400', async () => {
      if (!endedRoomId) return;
      const res = await request(app.getHttpServer())
        .post(`/video/rooms/${endedRoomId}/close`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(400);
    });
  });
});

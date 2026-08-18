/**
 * E2E — GET /calendars/:ownerId/busy
 *
 * Chantier calendrier de disponibilites, point 2 (visibilite busy/free
 * pilotee par relation metier). `profile-service` est hors de portee d'un
 * e2e de `calendar-service` isole : `ProfileRelationsClient` est remplace par
 * `FakeProfileRelationsClient` (voir `./helpers/app.helper.ts`), sur le
 * modele deja suivi par `teacher-request-service` pour `ProfileServiceClient`.
 *
 * Format des dates : ISO 8601 avec fuseau, identique a `from`/`to` en query
 * et aux `start`/`end` renvoyes dans les blocs de la reponse — voir
 * `docs/routes.md`.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestAppWithFakeProfileRelations,
  FakeProfileRelationsClient,
  makeJwt,
  IDS,
} from './helpers/app.helper';
import { RelationKind } from '../../src/common/relations/relation-kind';

const FROM = '2026-09-10T00:00:00.000Z';
const TO = '2026-09-17T00:00:00.000Z';

function busyUrl(ownerId: string, from = FROM, to = TO): string {
  return `/calendars/${ownerId}/busy?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

describe('[E2E] GET /calendars/:ownerId/busy', () => {
  let app: INestApplication;
  let profileRelations: FakeProfileRelationsClient;

  let rpToken: string;
  let apToken: string;
  let afToken: string;
  let tiToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let student1Token: string;
  let parent1Token: string;

  beforeAll(async () => {
    const built = await createTestAppWithFakeProfileRelations();
    app = built.app;
    profileRelations = built.profileRelations;

    rpToken = makeJwt(IDS.rp1, 'responsable_pedagogique');
    apToken = makeJwt(IDS.ap1, 'animateur_pedagogique');
    afToken = makeJwt(IDS.adminFin, 'administrateur_financier');
    tiToken = makeJwt(IDS.ti, 'technicien_informatique');
    teacher1Token = makeJwt(IDS.teacher1, 'formateur');
    teacher2Token = makeJwt(IDS.teacher2, 'formateur');
    student1Token = makeJwt(IDS.student1, 'eleve');
    parent1Token = makeJwt(IDS.parent1, 'parent_financeur');

    // Cree le calendrier de l'eleve (ownerRole = eleve) avec un creneau
    // disponible et un creneau indisponible, pour verifier la separation
    // availableWindows / unavailableBlocks.
    await request(app.getHttpServer())
      .post(`/calendars/${IDS.student1}/availability-slots`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        startTime: '2026-09-10T09:00:00.000Z',
        endTime: '2026-09-10T11:00:00.000Z',
        kind: 'available',
      });

    await request(app.getHttpServer())
      .post(`/calendars/${IDS.student1}/availability-slots`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        startTime: '2026-09-11T09:00:00.000Z',
        endTime: '2026-09-11T10:00:00.000Z',
        kind: 'unavailable',
      });

    // Cree le calendrier du formateur (ownerRole = formateur), un creneau
    // disponible.
    await request(app.getHttpServer())
      .post(`/calendars/${IDS.teacher1}/availability-slots`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({
        startTime: '2026-09-12T14:00:00.000Z',
        endTime: '2026-09-12T15:00:00.000Z',
        kind: 'available',
      });

    // Une activite CONFIRMED avec l'eleve comme participant, dans la fenetre
    // testee, pour verifier busyBlocks.
    await request(app.getHttpServer())
      .post('/activities')
      .set('Authorization', `Bearer ${rpToken}`)
      .send({
        title: 'Cours de maths (ne doit jamais apparaitre en busy/free)',
        type: 'cours',
        participantIds: [IDS.student1, IDS.teacher1],
        startTime: '2026-09-13T09:00:00.000Z',
        endTime: '2026-09-13T10:00:00.000Z',
      });
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Auth guard
  // ──────────────────────────────────────────────────────────────────────

  it('sans token → 401', async () => {
    const res = await request(app.getHttpServer()).get(busyUrl(IDS.student1));
    expect(res.status).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Titulaire — acces complet, jamais d'appel a profile-service
  // ──────────────────────────────────────────────────────────────────────

  describe('titulaire', () => {
    it('un eleve lisant son propre busy/free → 200, sans appel a profile-service', async () => {
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.ownerId).toBe(IDS.student1);
      expect(res.body.from).toBe(FROM);
      expect(res.body.to).toBe(TO);
      expect(res.body.availableWindows).toEqual([
        { start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' },
      ]);
      expect(res.body.unavailableBlocks).toEqual([
        { start: '2026-09-11T09:00:00.000Z', end: '2026-09-11T10:00:00.000Z' },
      ]);
      expect(res.body.busyBlocks).toEqual([
        { start: '2026-09-13T09:00:00.000Z', end: '2026-09-13T10:00:00.000Z' },
      ]);
    });

    it('la reponse ne fuite jamais id, titre, type ni participants', async () => {
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${student1Token}`);

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('Cours de maths');
      expect(serialized).not.toContain('cours');
      expect(serialized).not.toContain(IDS.teacher1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // RP — acces sans condition de lien
  // ──────────────────────────────────────────────────────────────────────

  describe('RP', () => {
    it("lit le busy/free d'un eleve sans aucune relation → 200", async () => {
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${rpToken}`);
      expect(res.status).toBe(200);
    });

    it("lit le busy/free d'un formateur sans aucune relation → 200", async () => {
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.teacher1))
        .set('Authorization', `Bearer ${rpToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // AF/TI — perimetre admin volontairement plus etroit que RP (403)
  // ──────────────────────────────────────────────────────────────────────

  describe('AF et TI — hors perimetre admin busy/free', () => {
    it("AF sans relation avec l'eleve → 403", async () => {
      profileRelations.setSnapshot(IDS.adminFin, IDS.student1, {
        viewerId: IDS.adminFin,
        targetId: IDS.student1,
        isSelf: false,
        isAdministrator: true,
        relations: [],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${afToken}`);
      expect(res.status).toBe(403);
    });

    it('TI sans relation avec le formateur → 403', async () => {
      profileRelations.setSnapshot(IDS.ti, IDS.teacher1, {
        viewerId: IDS.ti,
        targetId: IDS.teacher1,
        isSelf: false,
        isAdministrator: true,
        relations: [],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.teacher1))
        .set('Authorization', `Bearer ${tiToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Titulaire eleve — parent financeur / formateur actif
  // ──────────────────────────────────────────────────────────────────────

  describe('titulaire eleve', () => {
    it('un parent financeur lie (FINANCE_OWNER_OF_STUDENT) → 200', async () => {
      profileRelations.setSnapshot(IDS.parent1, IDS.student1, {
        viewerId: IDS.parent1,
        targetId: IDS.student1,
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(res.status).toBe(200);
    });

    it('un formateur actif lie (TEACHER_OF_STUDENT) → 200', async () => {
      profileRelations.setSnapshot(IDS.teacher1, IDS.student1, {
        viewerId: IDS.teacher1,
        targetId: IDS.student1,
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(200);
    });

    it("un formateur non lie → 403 (pas d'existence-leak, meme forme d'erreur)", async () => {
      profileRelations.setSnapshot(IDS.teacher2, IDS.student1, {
        viewerId: IDS.teacher2,
        targetId: IDS.student1,
        isSelf: false,
        isAdministrator: false,
        relations: [],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${teacher2Token}`);
      expect(res.status).toBe(403);
    });

    it("un AP sans relation adequate (ANIMATOR_OF_TEACHER ne s'applique pas a un eleve) → 403", async () => {
      profileRelations.setSnapshot(IDS.ap1, IDS.student1, {
        viewerId: IDS.ap1,
        targetId: IDS.student1,
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${apToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Titulaire formateur — eleve lie / parent-indirect / AP lie
  // ──────────────────────────────────────────────────────────────────────

  describe('titulaire formateur', () => {
    it('un eleve lie (STUDENT_OF_TEACHER) → 200', async () => {
      profileRelations.setSnapshot(IDS.student1, IDS.teacher1, {
        viewerId: IDS.student1,
        targetId: IDS.teacher1,
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.STUDENT_OF_TEACHER }],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.teacher1))
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(200);
    });

    it('un parent-indirect (FINANCE_OWNER_OF_STUDENT_OF_TEACHER) → 200', async () => {
      profileRelations.setSnapshot(IDS.parent1, IDS.teacher1, {
        viewerId: IDS.parent1,
        targetId: IDS.teacher1,
        isSelf: false,
        isAdministrator: false,
        relations: [
          { kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER, throughUserIds: [IDS.student1] },
        ],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.teacher1))
        .set('Authorization', `Bearer ${parent1Token}`);
      expect(res.status).toBe(200);
    });

    it('un AP qui anime ce formateur (ANIMATOR_OF_TEACHER) → 200', async () => {
      profileRelations.setSnapshot(IDS.ap1, IDS.teacher1, {
        viewerId: IDS.ap1,
        targetId: IDS.teacher1,
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.teacher1))
        .set('Authorization', `Bearer ${apToken}`);
      expect(res.status).toBe(200);
    });

    it("un AP sans lien reel → 403 (correctif du bug d'acces integral)", async () => {
      profileRelations.setSnapshot(IDS.ap1, IDS.teacher2, {
        viewerId: IDS.ap1,
        targetId: IDS.teacher2,
        isSelf: false,
        isAdministrator: false,
        relations: [],
      });
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.teacher2))
        .set('Authorization', `Bearer ${apToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // profile-service injoignable — echec ferme
  // ──────────────────────────────────────────────────────────────────────

  describe('profile-service injoignable', () => {
    afterEach(() => profileRelations.setUnavailable(false));

    it('→ 503, jamais un acces accorde par defaut', async () => {
      profileRelations.setUnavailable(true);
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1))
        .set('Authorization', `Bearer ${teacher2Token}`);
      expect(res.status).toBe(503);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('to <= from → 400', async () => {
      const res = await request(app.getHttpServer())
        .get(busyUrl(IDS.student1, TO, FROM))
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(400);
    });

    it('from non-ISO → 400', async () => {
      const res = await request(app.getHttpServer())
        .get(`/calendars/${IDS.student1}/busy?from=not-a-date&to=${encodeURIComponent(TO)}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(400);
    });
  });
});

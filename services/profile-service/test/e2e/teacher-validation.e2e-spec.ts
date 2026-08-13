/**
 * E2E — VALIDATION DES NOUVEAUX FORMATEURS (arbitrage du 2026-08-12)
 *
 * Ce fichier existe pour fermer un défaut précis, mesuré contre la pile réelle :
 * un formateur créé par `POST /accounts/teachers` était lu `pending`
 * individuellement, mais **n'apparaissait jamais** dans
 * `GET /profiles/teachers/pending-validation`. L'inscription ne créait aucun
 * enregistrement de validation ; la lecture unitaire en fabriquait un de
 * synthèse, la liste ne montrait que les lignes réelles. Le formateur n'était
 * donc jamais vu du RP, jamais validé, jamais proposable — cul-de-sac
 * silencieux, avec un écran qui affichait « en attente » à quelqu'un que
 * personne ne devait jamais examiner.
 *
 * LA PROPRIÉTÉ CENTRALE VÉRIFIÉE ICI : **lecture unitaire et liste ne peuvent
 * plus se contredire.** Un formateur lu `pending` est dans la file, sans
 * exception. C'est ce que des dépôts simulés ne montreraient pas — il faut deux
 * chemins de code distincts frappant la même base.
 *
 * Sont joués contre une vraie base PostgreSQL :
 *  - la création de l'enregistrement sur les DEUX chemins d'inscription ;
 *  - la reprise de stock, son idempotence et sa non-destructivité ;
 *  - la cohérence lecture unitaire ↔ liste ;
 *  - la pagination et les droits de la file.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, INTERNAL_SECRET, IDS } from './helpers/app.helper';
import {
  computeReapplyEligibleAt,
  formatFrenchDate,
} from '../../src/profiles/teacher-validation.view';

/** Identifiants dédiés à ce fichier — plage `b*`, pour n'entrer en collision avec aucun autre. */
const TEACHERS = {
  /** Inscrit par `create-teacher-profiles` (workflow orchestré). */
  orchestrated: '00000000-0000-4000-8000-0000000000b1',
  /** Inscrit par `create-administrative-profile` + rôle — le chemin réel. */
  selfRegistered: '00000000-0000-4000-8000-0000000000b2',
  /** Compte antérieur à la correction : aucun enregistrement, repris par le backfill. */
  legacy: '00000000-0000-4000-8000-0000000000b3',
  /** Déjà validé avant la reprise de stock : ne doit JAMAIS repasser à pending. */
  alreadyValidated: '00000000-0000-4000-8000-0000000000b4',
  /** Déjà refusé avant la reprise de stock : ne doit JAMAIS repasser à pending. */
  alreadyRejected: '00000000-0000-4000-8000-0000000000b5',
};

/** Compte non-formateur : aucun enregistrement de validation ne doit être créé. */
const STUDENT = IDS.student1;

describe('[E2E] Validation des nouveaux formateurs', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  let rpToken: string;
  let tiToken: string;

  const internalHeaders = { 'x-internal-secret': INTERNAL_SECRET };

  const listPending = (query = '') =>
    request(server)
      .get(`/profiles/teachers/pending-validation${query}`)
      .set('Authorization', `Bearer ${rpToken}`);

  const readValidation = (teacherId: string) =>
    request(server)
      .get(`/profiles/${teacherId}/validation`)
      .set('Authorization', `Bearer ${rpToken}`);

  const pendingUserIds = async (): Promise<string[]> => {
    const response = await listPending('?limit=100').expect(200);
    return response.body.data.map((entry: { userId: string }) => entry.userId);
  };

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    rpToken = makeJwt(IDS.rp1, 'responsable_pedagogique');
    tiToken = makeJwt(IDS.ti, 'technicien_informatique');

    // Chemin 1 — workflow orchestré `teacher-onboarding`.
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({
        userId: TEACHERS.orchestrated,
        firstName: 'Olivia',
        lastName: 'Orchestrée',
        levels: ['seconde'],
        subjects: ['mathematiques'],
      })
      .expect(201);

    // Chemin 2 — celui qu'emprunte réellement `POST /accounts/teachers`.
    await request(server)
      .post('/internal/create-administrative-profile')
      .set(internalHeaders)
      .send({
        userId: TEACHERS.selfRegistered,
        firstName: 'Simon',
        lastName: 'Sinscrit',
        role: 'formateur',
      })
      .expect(201);

    // Un élève, pour vérifier qu'aucun enregistrement ne lui est créé.
    await request(server)
      .post('/internal/create-administrative-profile')
      .set(internalHeaders)
      .send({
        userId: STUDENT,
        firstName: 'Théo',
        lastName: 'Élève',
        role: 'eleve',
      })
      .expect(201);

    // Comptes « avant correction » : profil administratif seul, sans rôle
    // transmis — donc sans enregistrement de validation, exactement l'état du
    // stock trouvé en base le 2026-08-12.
    for (const [userId, firstName, lastName] of [
      [TEACHERS.legacy, 'Léa', 'Legacy'],
      [TEACHERS.alreadyValidated, 'Valérie', 'Validée'],
      [TEACHERS.alreadyRejected, 'Rémi', 'Refusé'],
    ]) {
      await request(server)
        .post('/internal/create-administrative-profile')
        .set(internalHeaders)
        .send({ userId, firstName, lastName })
        .expect(201);
    }
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // ---------------------------------------------------------------------------
  // Le défaut d'origine : l'inscription crée bien l'enregistrement
  // ---------------------------------------------------------------------------

  describe("l'inscription crée l'enregistrement de validation", () => {
    it('workflow orchestré : le formateur est dans la file du RP', async () => {
      expect(await pendingUserIds()).toContain(TEACHERS.orchestrated);
    });

    it('inscription directe (rôle transmis) : le formateur est dans la file du RP', async () => {
      expect(await pendingUserIds()).toContain(TEACHERS.selfRegistered);
    });

    it('la réponse de create-teacher-profiles porte la validation enregistrée', async () => {
      const response = await request(server)
        .post('/internal/create-teacher-profiles')
        .set(internalHeaders)
        .send({
          userId: '00000000-0000-4000-8000-0000000000bf',
          firstName: 'Rejeu',
          lastName: 'Idempotent',
        })
        .expect(201);

      expect(response.body.validation).toMatchObject({ status: 'pending' });
    });

    it("un élève ne reçoit AUCUN enregistrement de validation", async () => {
      expect(await pendingUserIds()).not.toContain(STUDENT);
    });

    it('sans rôle transmis, aucun enregistrement n\'est créé (rien n\'est deviné)', async () => {
      expect(await pendingUserIds()).not.toContain(TEACHERS.legacy);
    });
  });

  // ---------------------------------------------------------------------------
  // LA propriété : lecture unitaire et liste ne se contredisent plus
  // ---------------------------------------------------------------------------

  describe('cohérence entre la lecture unitaire et la liste', () => {
    it('tout formateur lu « pending » est dans la file, sans exception', async () => {
      const listed = await pendingUserIds();

      for (const teacherId of [TEACHERS.orchestrated, TEACHERS.selfRegistered]) {
        const read = await readValidation(teacherId).expect(200);
        expect(read.body.status).toBe('pending');
        expect(listed).toContain(teacherId);
      }
    });

    it('un formateur sorti de « pending » quitte la file au même instant', async () => {
      await request(server)
        .patch(`/profiles/${TEACHERS.orchestrated}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'in_review' })
        .expect(200);

      const read = await readValidation(TEACHERS.orchestrated).expect(200);
      expect(read.body.status).toBe('in_review');
      expect(await pendingUserIds()).not.toContain(TEACHERS.orchestrated);

      // Remis en état pour les tests suivants : in_review → validated puis on
      // n'y touche plus.
      await request(server)
        .patch(`/profiles/${TEACHERS.orchestrated}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'validated' })
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Reprise de stock — arbitrage du 2026-08-12, point 3
  // ---------------------------------------------------------------------------

  describe('reprise de stock des formateurs déjà inscrits', () => {
    it('rend visible un formateur antérieur à la correction', async () => {
      expect(await pendingUserIds()).not.toContain(TEACHERS.legacy);

      const response = await request(server)
        .post('/internal/teachers/ensure-validations')
        .set(internalHeaders)
        .send({ teacherIds: [TEACHERS.legacy] })
        .expect(200);

      expect(response.body.created).toEqual([TEACHERS.legacy]);
      expect(await pendingUserIds()).toContain(TEACHERS.legacy);
    });

    it('est idempotente : un second passage ne crée plus rien', async () => {
      const response = await request(server)
        .post('/internal/teachers/ensure-validations')
        .set(internalHeaders)
        .send({ teacherIds: [TEACHERS.legacy] })
        .expect(200);

      expect(response.body.created).toEqual([]);
      expect(response.body.alreadyPresent).toEqual([TEACHERS.legacy]);
    });

    /**
     * LE CAS D'ERREUR LE PLUS GRAVE. Repasser un formateur validé en `pending`
     * annulerait la décision d'un RP sans trace ; repasser un formateur refusé
     * en `pending` lui rouvrirait la porte. La reprise de stock doit être sûre
     * à lancer sur l'intégralité du stock, pas seulement sur les manquants.
     */
    it('ne repasse JAMAIS un formateur validé ou refusé à pending', async () => {
      await request(server)
        .patch(`/profiles/${TEACHERS.alreadyValidated}/validation`)
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'validated', comment: 'Validé avant la reprise de stock.' })
        .expect(200);
      await request(server)
        .patch(`/profiles/${TEACHERS.alreadyRejected}/validation`)
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'rejected', comment: 'Refusé avant la reprise de stock.' })
        .expect(200);

      const response = await request(server)
        .post('/internal/teachers/ensure-validations')
        .set(internalHeaders)
        .send({
          teacherIds: [TEACHERS.alreadyValidated, TEACHERS.alreadyRejected, TEACHERS.legacy],
        })
        .expect(200);

      expect(response.body.created).toEqual([]);
      expect(await readValidation(TEACHERS.alreadyValidated).expect(200)).toHaveProperty(
        'body.status',
        'validated',
      );
      expect(await readValidation(TEACHERS.alreadyRejected).expect(200)).toHaveProperty(
        'body.status',
        'rejected',
      );

      // Le commentaire du RP n'est pas davantage écrasé que le statut.
      const validated = await readValidation(TEACHERS.alreadyValidated).expect(200);
      expect(validated.body.comment).toBe('Validé avant la reprise de stock.');

      const pending = await pendingUserIds();
      expect(pending).not.toContain(TEACHERS.alreadyValidated);
      expect(pending).not.toContain(TEACHERS.alreadyRejected);
    });

    it('réduit les doublons de la liste à une seule entrée', async () => {
      const response = await request(server)
        .post('/internal/teachers/ensure-validations')
        .set(internalHeaders)
        .send({ teacherIds: [TEACHERS.legacy, TEACHERS.legacy, TEACHERS.legacy] })
        .expect(200);

      expect(response.body.alreadyPresent).toEqual([TEACHERS.legacy]);
    });

    it('refuse une liste vide plutôt que de répondre un succès creux', async () => {
      await request(server)
        .post('/internal/teachers/ensure-validations')
        .set(internalHeaders)
        .send({ teacherIds: [] })
        .expect(400);
    });

    it('refuse un identifiant qui n\'est pas un UUID', async () => {
      await request(server)
        .post('/internal/teachers/ensure-validations')
        .set(internalHeaders)
        .send({ teacherIds: ['pas-un-uuid'] })
        .expect(400);
    });

    it('refuse un appel sans le secret interne', async () => {
      await request(server)
        .post('/internal/teachers/ensure-validations')
        .send({ teacherIds: [TEACHERS.legacy] })
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // La file : forme, bornes et droits — alignée sur l'annuaire des validés
  // ---------------------------------------------------------------------------

  describe('forme et bornes de la file', () => {
    it('renvoie une enveloppe paginée, jamais un tableau nu', async () => {
      const response = await listPending().expect(200);

      expect(Array.isArray(response.body)).toBe(false);
      expect(Object.keys(response.body).sort()).toEqual([
        'data',
        'limit',
        'page',
        'total',
        'totalPages',
      ]);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('sert le socle plus pendingSince, et rien de plus', async () => {
      const response = await listPending().expect(200);

      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        'firstName',
        'lastName',
        'levels',
        'pendingSince',
        'subjects',
        'userId',
      ]);
    });

    it('ne laisse fuir aucune donnée hors socle', async () => {
      const response = await listPending('?limit=100').expect(200);
      const serialized = JSON.stringify(response.body);

      expect(serialized).not.toContain('teacherId');
      expect(serialized).not.toContain('validatedBy');
      expect(serialized).not.toContain('comment');
    });

    it('trie par ancienneté : le plus ancien en attente vient en premier', async () => {
      const response = await listPending('?limit=100').expect(200);
      const dates = response.body.data.map((entry: { pendingSince: string }) =>
        new Date(entry.pendingSince).getTime(),
      );

      expect(dates).toEqual([...dates].sort((first, second) => first - second));
    });

    it('refuse un limit au-dessus du plafond, en français et sans rogner', async () => {
      const response = await listPending('?limit=101').expect(400);

      expect(JSON.stringify(response.body)).toContain('100');
    });

    it('accepte exactement le plafond', async () => {
      await listPending('?limit=100').expect(200);
    });

    it('refuse page=0 — la pagination commence à 1', async () => {
      await listPending('?page=0').expect(400);
    });

    it('refuse un paramètre de requête inconnu plutôt que de l\'ignorer', async () => {
      await listPending('?statut=pending').expect(400);
    });

    it('renvoie une page vide au-delà de la dernière, sans erreur', async () => {
      const response = await listPending('?page=99').expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('droits sur la file', () => {
    it.each([
      ['technicien_informatique', IDS.ti],
      ['administrateur_financier', IDS.adminFin],
      ['animateur_pedagogique', IDS.ap1],
      ['eleve', IDS.student1],
      ['parent_financeur', IDS.parent1],
    ])('refuse le rôle %s en 403', async (role, userId) => {
      await request(server)
        .get('/profiles/teachers/pending-validation')
        .set('Authorization', `Bearer ${makeJwt(userId, role)}`)
        .expect(403);
    });

    it('refuse un appel sans jeton en 401', async () => {
      await request(server).get('/profiles/teachers/pending-validation').expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Messages en français — règle de langue du 2026-08-09
  // ---------------------------------------------------------------------------

  describe('messages de refus en français', () => {
    it('le RP ne peut pas sauter l\'étape « en cours d\'examen »', async () => {
      const response = await request(server)
        .patch(`/profiles/${TEACHERS.selfRegistered}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'validated' })
        .expect(403);

      expect(response.body.message).toContain('technicien informatique');
      expect(response.body.message).toContain('en cours d’examen');
      // Le message anglais d'origine ne doit plus apparaître nulle part.
      expect(response.body.message).not.toContain('Only TI');
      expect(response.body.message).not.toContain('bypass');
    });

    it('un statut identique au statut courant est refusé en français', async () => {
      const response = await request(server)
        .patch(`/profiles/${TEACHERS.selfRegistered}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'pending' })
        .expect(403);

      expect(response.body.message).toContain('déjà au statut');
      expect(response.body.message).toContain('en attente');
    });

    it('un statut hors énumération est refusé en français', async () => {
      const response = await request(server)
        .patch(`/profiles/${TEACHERS.selfRegistered}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'valide' })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('Le statut doit être');
    });

    it('un formateur ne peut pas lire le statut d\'un autre', async () => {
      const response = await request(server)
        .get(`/profiles/${TEACHERS.selfRegistered}/validation`)
        .set('Authorization', `Bearer ${makeJwt(TEACHERS.legacy, 'formateur')}`)
        .expect(403);

      expect(response.body.message).toContain('votre propre statut');
    });
  });

  // ---------------------------------------------------------------------------
  // Journal append-only et reprise de candidature — arbitrage du 2026-08-13
  // « Reprise de candidature après un refus formateur »
  // ---------------------------------------------------------------------------

  describe('journal append-only et reprise de candidature (arbitrage du 2026-08-13)', () => {
    /** Plage `c*`, dédiée à ce bloc pour n'entrer en collision avec aucun autre. */
    const REJECTED_TEACHER = '00000000-0000-4000-8000-0000000000c1';
    const OTHER_TEACHER = '00000000-0000-4000-8000-0000000000c2';

    const readValidationAs = (teacherId: string, token: string) =>
      request(server)
        .get(`/profiles/${teacherId}/validation`)
        .set('Authorization', `Bearer ${token}`);

    const reapplyAs = (teacherId: string, token: string) =>
      request(server)
        .post(`/profiles/${teacherId}/validation/reapply`)
        .set('Authorization', `Bearer ${token}`);

    let rejectedTeacherToken: string;
    let otherTeacherToken: string;

    beforeAll(async () => {
      rejectedTeacherToken = makeJwt(REJECTED_TEACHER, 'formateur');
      otherTeacherToken = makeJwt(OTHER_TEACHER, 'formateur');

      for (const [userId, firstName, lastName] of [
        [REJECTED_TEACHER, 'Rachel', 'Refusée'],
        [OTHER_TEACHER, 'Oscar', 'Autre'],
      ]) {
        await request(server)
          .post('/internal/create-administrative-profile')
          .set(internalHeaders)
          .send({ userId, firstName, lastName, role: 'formateur' })
          .expect(201);
      }

      // pending → in_review → rejected : trois transitions, donc trois lignes
      // journalisées si l'append-only fonctionne.
      await request(server)
        .patch(`/profiles/${REJECTED_TEACHER}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'in_review' })
        .expect(200);

      await request(server)
        .patch(`/profiles/${REJECTED_TEACHER}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'rejected', comment: 'Expérience insuffisante.' })
        .expect(200);
    });

    it("GET renvoie le statut « rejected » avec reapplyEligibleAt, calculé sur l'année scolaire du refus", async () => {
      const response = await readValidationAs(REJECTED_TEACHER, rpToken).expect(200);

      expect(response.body.status).toBe('rejected');
      expect(response.body.comment).toBe('Expérience insuffisante.');
      expect(response.body).toHaveProperty('reapplyEligibleAt');

      const rejectedAt = new Date(response.body.createdAt);
      const expected = computeReapplyEligibleAt(rejectedAt);
      expect(new Date(response.body.reapplyEligibleAt)).toEqual(expected);
    });

    it("GET ne porte PAS reapplyEligibleAt pour un statut autre que rejected", async () => {
      const response = await readValidationAs(TEACHERS.orchestrated, rpToken).expect(200);

      expect(response.body.status).not.toBe('rejected');
      expect(response.body).not.toHaveProperty('reapplyEligibleAt');
    });

    it("la ligne « rejected » n'est jamais réécrite : le commentaire de la transition précédente n'apparaît pas dessus", async () => {
      const response = await readValidationAs(REJECTED_TEACHER, rpToken).expect(200);

      // Seul le commentaire de la DERNIÈRE transition (rejected) doit
      // apparaître ; la prise en charge (in_review) n'en portait aucun.
      expect(response.body.comment).toBe('Expérience insuffisante.');
    });

    it('refuse la reprise (400, message français citant la date) tant que l\'échéance n\'est pas atteinte', async () => {
      const response = await reapplyAs(REJECTED_TEACHER, rejectedTeacherToken).expect(400);

      const expectedDate = formatFrenchDate(
        computeReapplyEligibleAt(new Date(
          (await readValidationAs(REJECTED_TEACHER, rpToken).expect(200)).body.createdAt,
        )),
      );
      expect(response.body.message).toContain(expectedDate);
    });

    it('refuse la reprise (400) pour un formateur dont le statut courant n\'est pas rejected', async () => {
      const response = await reapplyAs(TEACHERS.orchestrated, makeJwt(TEACHERS.orchestrated, 'formateur'))
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('refuse la reprise (403) pour un autre formateur que celui concerné', async () => {
      await reapplyAs(REJECTED_TEACHER, otherTeacherToken).expect(403);
    });

    it('refuse la reprise (403) pour le RP — pas de droit de contournement dans cette tâche', async () => {
      await reapplyAs(REJECTED_TEACHER, rpToken).expect(403);
    });

    it('refuse la reprise (403) pour le TI — pas de droit de contournement dans cette tâche', async () => {
      await reapplyAs(REJECTED_TEACHER, tiToken).expect(403);
    });

    it('refuse la reprise sans jeton (401)', async () => {
      await request(server)
        .post(`/profiles/${REJECTED_TEACHER}/validation/reapply`)
        .expect(401);
    });
  });
});

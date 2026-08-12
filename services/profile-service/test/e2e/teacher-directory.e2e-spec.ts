/**
 * E2E — ANNUAIRE DES FORMATEURS VALIDÉS (arbitrage du 2026-08-12)
 *
 *   GET /profiles/teachers/validated
 *
 * Ce qui est joué contre une vraie base PostgreSQL, et pas seulement simulé :
 *  - le CHEMIN à deux segments n'est PAS capté par `GET /profiles/:userId` —
 *    c'est cette collision qui faisait répondre `400` à `/profiles/teachers` ;
 *  - la requête SQL réelle (jointures, tri global, fenêtre de pagination) et la
 *    conversion des colonnes `simple-array`, que des dépôts simulés ne
 *    montreraient jamais ;
 *  - le périmètre : seuls les formateurs `validated`, seulement pour RP, AF, TI.
 *
 * Le jeu de données :
 *   Alice ANDRÉ    — validée
 *   Bruno BERNARD  — validée
 *   Chloé ZAHIR    — validée
 *   Denis ATTENTE  — validation `in_review` : ne doit PAS apparaître
 *   Émile SANSDEMANDE — aucun enregistrement de validation : ne doit PAS apparaître
 *   Théo ÉLÈVE     — un élève : ne doit PAS apparaître
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, INTERNAL_SECRET, IDS } from './helpers/app.helper';

const TEACHERS = {
  andre: '00000000-0000-4000-8000-0000000000a1',
  bernard: '00000000-0000-4000-8000-0000000000a2',
  zahir: '00000000-0000-4000-8000-0000000000a3',
  pending: '00000000-0000-4000-8000-0000000000a4',
  noValidation: '00000000-0000-4000-8000-0000000000a5',
  /** Formateur validé SANS profil administratif — incohérence de données. */
  orphan: '00000000-0000-4000-8000-0000000000a6',
};

describe('[E2E] Annuaire des formateurs validés', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  let rpToken: string;
  let afToken: string;
  let tiToken: string;
  let apToken: string;
  let teacherToken: string;
  let studentToken: string;
  let parentToken: string;

  const internalHeaders = { 'x-internal-secret': INTERNAL_SECRET };

  const asRp = (path: string) =>
    request(server).get(path).set('Authorization', `Bearer ${rpToken}`);

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    rpToken = makeJwt(IDS.rp1, 'responsable_pedagogique');
    afToken = makeJwt(IDS.adminFin, 'administrateur_financier');
    tiToken = makeJwt(IDS.ti, 'technicien_informatique');
    apToken = makeJwt(IDS.ap1, 'animateur_pedagogique');
    teacherToken = makeJwt(TEACHERS.andre, 'formateur');
    studentToken = makeJwt(IDS.student1, 'eleve');
    parentToken = makeJwt(IDS.parent1, 'parent_financeur');

    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({
        userId: TEACHERS.andre,
        firstName: 'Alice',
        lastName: 'André',
        phone: '0600000001',
        levels: ['seconde', 'premiere'],
        subjects: ['mathematiques'],
      })
      .expect(201);
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({
        userId: TEACHERS.bernard,
        firstName: 'Bruno',
        lastName: 'Bernard',
        levels: ['terminale'],
        subjects: ['mathematiques', 'physique'],
      })
      .expect(201);
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({ userId: TEACHERS.zahir, firstName: 'Chloé', lastName: 'Zahir' })
      .expect(201);
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({ userId: TEACHERS.pending, firstName: 'Denis', lastName: 'Attente' })
      .expect(201);
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({ userId: TEACHERS.noValidation, firstName: 'Émile', lastName: 'Sansdemande' })
      .expect(201);
    await request(server)
      .post('/internal/create-student-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.student1, firstName: 'Théo', lastName: 'Élève', level: '3e' })
      .expect(201);

    // Validation : pending → in_review → validated, le parcours réel du RP.
    for (const teacherId of [TEACHERS.andre, TEACHERS.bernard, TEACHERS.zahir]) {
      await request(server)
        .patch(`/profiles/${teacherId}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'in_review' })
        .expect(200);
      await request(server)
        .patch(`/profiles/${teacherId}/validation`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ status: 'validated' })
        .expect(200);
    }
    await request(server)
      .patch(`/profiles/${TEACHERS.pending}/validation`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ status: 'in_review' })
      .expect(200);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // ---------------------------------------------------------------------------

  describe('la route existe et n\'est pas captée par GET /profiles/:userId', () => {
    it('répond 200, et non 400 « userId non-UUID »', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('périmètre : les formateurs validés, et eux seuls', () => {
    it('liste les trois formateurs validés', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);

      expect(response.body.total).toBe(3);
      expect(response.body.data.map((teacher: { userId: string }) => teacher.userId)).toEqual([
        TEACHERS.andre,
        TEACHERS.bernard,
        TEACHERS.zahir,
      ]);
    });

    it('exclut le formateur encore en cours de validation', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);
      const userIds = response.body.data.map((teacher: { userId: string }) => teacher.userId);

      expect(userIds).not.toContain(TEACHERS.pending);
      expect(userIds).not.toContain(TEACHERS.noValidation);
    });

    it('exclut les élèves', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);
      const userIds = response.body.data.map((teacher: { userId: string }) => teacher.userId);

      expect(userIds).not.toContain(IDS.student1);
    });

    it('ne recoupe pas la liste des formateurs en attente', async () => {
      const pending = await asRp('/profiles/teachers/pending-validation').expect(200);
      const validated = await asRp('/profiles/teachers/validated').expect(200);

      const pendingIds = pending.body.map((entry: { teacherId: string }) => entry.teacherId);
      const validatedIds = validated.body.data.map((entry: { userId: string }) => entry.userId);

      expect(validatedIds.some((id: string) => pendingIds.includes(id))).toBe(false);
    });
  });

  describe('contenu : le socle de visibilité, rien de plus', () => {
    it('sert exactement userId, firstName, lastName, levels, subjects', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);

      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        'firstName',
        'lastName',
        'levels',
        'subjects',
        'userId',
      ]);
    });

    it('ne laisse fuir aucune donnée hors socle (téléphone, adresse, prescription)', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);
      const serialized = JSON.stringify(response.body);

      expect(serialized).not.toContain('0600000001');
      expect(serialized).not.toContain('phone');
      expect(serialized).not.toContain('maxValidatedLevel');
      expect(serialized).not.toContain('testResults');
    });

    it('renvoie de vrais tableaux pour levels et subjects', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);
      const alice = response.body.data.find(
        (teacher: { userId: string }) => teacher.userId === TEACHERS.andre,
      );

      expect(alice.levels).toEqual(['seconde', 'premiere']);
      expect(alice.subjects).toEqual(['mathematiques']);
    });

    it('distingue « non renseigné » (null) d\'une liste vide', async () => {
      const response = await asRp('/profiles/teachers/validated').expect(200);
      const chloe = response.body.data.find(
        (teacher: { userId: string }) => teacher.userId === TEACHERS.zahir,
      );

      expect(chloe.levels).toBeNull();
      expect(chloe.subjects).toBeNull();
      expect(chloe.firstName).toBe('Chloé');
    });
  });

  describe('droits d\'accès : rôles administratifs seulement', () => {
    it.each([
      ['responsable pédagogique', () => rpToken],
      ['administrateur financier', () => afToken],
      ['technicien informatique', () => tiToken],
    ])('autorise le %s', async (_label, token) => {
      await request(server)
        .get('/profiles/teachers/validated')
        .set('Authorization', `Bearer ${token()}`)
        .expect(200);
    });

    it.each([
      ['formateur', () => teacherToken],
      ['élève', () => studentToken],
      ['parent financeur', () => parentToken],
      ['animateur pédagogique', () => apToken],
    ])('refuse le %s en 403', async (_label, token) => {
      await request(server)
        .get('/profiles/teachers/validated')
        .set('Authorization', `Bearer ${token()}`)
        .expect(403);
    });

    it('refuse un appel sans jeton en 401', async () => {
      await request(server).get('/profiles/teachers/validated').expect(401);
    });
  });

  describe('pagination bornée', () => {
    it('découpe la liste et annonce le total global', async () => {
      const response = await asRp('/profiles/teachers/validated?page=1&limit=2').expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({ page: 1, limit: 2, total: 3, totalPages: 2 }),
      );
      expect(response.body.data).toHaveLength(2);
    });

    it('trie sur l\'ensemble de la liste, pas page par page', async () => {
      const first = await asRp('/profiles/teachers/validated?page=1&limit=2').expect(200);
      const second = await asRp('/profiles/teachers/validated?page=2&limit=2').expect(200);

      expect(first.body.data.map((teacher: { lastName: string }) => teacher.lastName)).toEqual([
        'André',
        'Bernard',
      ]);
      expect(second.body.data.map((teacher: { lastName: string }) => teacher.lastName)).toEqual([
        'Zahir',
      ]);
    });

    it('renvoie une page vide au-delà de la dernière, sans erreur', async () => {
      const response = await asRp('/profiles/teachers/validated?page=99').expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(3);
    });

    it('refuse un limit au-dessus du plafond, en français et sans rogner', async () => {
      const response = await asRp('/profiles/teachers/validated?limit=101').expect(400);

      expect(JSON.stringify(response.body.message)).toContain('ne peut pas dépasser 100');
    });

    it('accepte exactement le plafond', async () => {
      await asRp('/profiles/teachers/validated?limit=100').expect(200);
    });

    it('refuse page=0 — la pagination commence à 1', async () => {
      const response = await asRp('/profiles/teachers/validated?page=0').expect(400);

      expect(JSON.stringify(response.body.message)).toContain('commence à 1');
    });

    it('refuse une valeur non numérique', async () => {
      await asRp('/profiles/teachers/validated?limit=beaucoup').expect(400);
    });

    it('refuse un paramètre de requête inconnu plutôt que de l\'ignorer', async () => {
      await asRp('/profiles/teachers/validated?niveau=terminale').expect(400);
    });
  });

  describe('incohérence de données', () => {
    it('conserve un formateur validé sans profil administratif, noms à null', async () => {
      await request(server)
        .patch(`/profiles/${TEACHERS.orphan}/validation`)
        .set('Authorization', `Bearer ${tiToken}`)
        .send({ status: 'validated' })
        .expect(200);

      const response = await asRp('/profiles/teachers/validated?limit=100').expect(200);
      const orphan = response.body.data.find(
        (teacher: { userId: string }) => teacher.userId === TEACHERS.orphan,
      );

      expect(orphan).toEqual({
        userId: TEACHERS.orphan,
        firstName: null,
        lastName: null,
        levels: null,
        subjects: null,
      });
      // Trié en dernier : un enregistrement abîmé ne prend pas la tête de liste.
      expect(response.body.data[response.body.data.length - 1].userId).toBe(TEACHERS.orphan);
    });
  });
});

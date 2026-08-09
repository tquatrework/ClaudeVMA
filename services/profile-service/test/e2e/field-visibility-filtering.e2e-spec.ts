/**
 * E2E — Application EN LECTURE de la visibilité champ par champ
 * (arbitrage du 2026-08-09, `docs/architecture.md` > « Arbitrages rendus »).
 *
 * Scénario de référence, joué de bout en bout contre une vraie base :
 * l'élève masque `difficulties` et `phone` en les réglant `self` via
 * PUT /profiles/:userId/field-visibility, puis
 *   - son PARENT FINANCEUR rattaché les voit quand même (exempté) ;
 *   - son FORMATEUR rattaché ne les voit pas (contact lié, filtré) ;
 *   - lui-même voit tout, prescription comprise.
 *
 * Routes testées :
 *   PUT /profiles/:userId/field-visibility
 *   GET /profiles/:userId
 *   GET /profiles/:userId/statistics
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  makeJwt,
  INTERNAL_SECRET,
  IDS,
  identityAccessStub,
} from './helpers/app.helper';

describe('[E2E] Filtrage de la visibilité champ par champ', () => {
  let app: INestApplication;

  let studentToken: string;
  let parentToken: string;
  let linkedTeacherToken: string;
  let unlinkedTeacherToken: string;
  let rpToken: string;

  const headers = { 'x-internal-secret': INTERNAL_SECRET };

  beforeAll(async () => {
    app = await createTestApp();

    studentToken = makeJwt(IDS.student1, 'eleve');
    parentToken = makeJwt(IDS.parent1, 'parent_financeur');
    linkedTeacherToken = makeJwt(IDS.teacher1, 'formateur');
    unlinkedTeacherToken = makeJwt(IDS.teacher2, 'formateur');
    rpToken = makeJwt(IDS.rp1, 'responsable_pedagogique');

    identityAccessStub.registerAccount(IDS.student1, 'alice.dupont', 'eleve');
    identityAccessStub.registerAccount(IDS.teacher1, 'bob.martin', 'formateur');

    // --- Profils -------------------------------------------------------------
    await request(app.getHttpServer())
      .post('/internal/create-student-profiles')
      .set(headers)
      .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' });

    await request(app.getHttpServer())
      .post('/internal/create-teacher-profiles')
      .set(headers)
      .send({ userId: IDS.teacher1, firstName: 'Bob', lastName: 'Martin' });

    // Données personnelles réellement renseignées, sans quoi « masqué » et
    // « vide » seraient indiscernables pour de mauvaises raisons.
    await request(app.getHttpServer())
      .put(`/profiles/${IDS.student1}/administrative`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phone: '0600000000', city: 'Lyon' });

    await request(app.getHttpServer())
      .put(`/profiles/${IDS.student1}/pedagogical`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        level: '3ème',
        subjects: ['maths'],
        difficulties: 'Trigonométrie',
        goals: 'Progresser en géométrie',
      });

    // Prescription rédigée par le RP : le titulaire doit la lire, le formateur non.
    await request(app.getHttpServer())
      .put(`/profiles/${IDS.student1}/prescription`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ generalAssessment: 'Élève sérieuse', recommendedPace: '2h par semaine' });

    // --- Relations -----------------------------------------------------------
    await request(app.getHttpServer())
      .post('/internal/link-parent')
      .set(headers)
      .send({ studentId: IDS.student1, financeOwnerId: IDS.parent1 });

    await request(app.getHttpServer())
      .post('/internal/create-teacher-student-relation')
      .set(headers)
      .send({ teacherId: IDS.teacher1, studentId: IDS.student1 });

    // --- L'élève masque explicitement deux champs ---------------------------
    const settings = await request(app.getHttpServer())
      .put(`/profiles/${IDS.student1}/field-visibility`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        fields: [
          { fieldName: 'difficulties', audience: 'self' },
          { fieldName: 'phone', audience: 'self' },
        ],
      });
    expect(settings.status).toBe(200);
  });

  afterAll(async () => {
    await app?.close();
  });

  // ---------------------------------------------------------------------------
  // Le titulaire
  // ---------------------------------------------------------------------------
  describe('le titulaire', () => {
    it('voit sa fiche intégralement, prescription comprise', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.administrative.phone).toBe('0600000000');
      expect(res.body.pedagogical.difficulties).toBe('Trigonométrie');
      expect(res.body.pedagogical.generalAssessment).toBe('Élève sérieuse');
      expect(res.body.pedagogical.recommendedPace).toBe('2h par semaine');
    });

    it('reçoit visibility.isFiltered = false', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
    });
  });

  // ---------------------------------------------------------------------------
  // Le parent financeur — exempté
  // ---------------------------------------------------------------------------
  describe('le parent financeur rattaché', () => {
    it('voit un champ que son élève a réglé `self`', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      // « Le parent financeur voit tout, sauf le carnet personnel. »
      expect(res.body.pedagogical.difficulties).toBe('Trigonométrie');
      expect(res.body.administrative.phone).toBe('0600000000');
    });

    it('voit aussi la prescription rédigée par le RP', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.pedagogical.generalAssessment).toBe('Élève sérieuse');
    });

    it('reçoit visibility.isFiltered = false — il n\'est soumis à aucun réglage', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
    });

    it('reste refusé en 403 sur un élève auquel il n\'est PAS rattaché', async () => {
      await request(app.getHttpServer())
        .get(`/profiles/${IDS.student2}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Le formateur lié — filtré
  // ---------------------------------------------------------------------------
  describe('le formateur rattaché', () => {
    it('ne voit PAS les champs réglés `self` par l\'élève', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);

      expect(res.body.pedagogical).not.toHaveProperty('difficulties');
      expect(res.body.administrative).not.toHaveProperty('phone');
    });

    it('reçoit les champs masqués NOMMÉS, pas seulement absents', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);

      expect(res.body.visibility.isFiltered).toBe(true);
      expect(res.body.visibility.hiddenFields).toEqual(
        expect.arrayContaining(['difficulties', 'phone']),
      );
    });

    it('voit le socle par défaut : prénom, nom, niveau, matières', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);

      expect(res.body.administrative.firstName).toBe('Alice');
      expect(res.body.administrative.lastName).toBe('Dupont');
      expect(res.body.pedagogical.level).toBe('3ème');
      expect(res.body.pedagogical.subjects).toEqual(['maths']);
    });

    it('ne voit NI la prescription NI ses métadonnées', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);

      expect(res.body.pedagogical).not.toHaveProperty('generalAssessment');
      expect(res.body.pedagogical).not.toHaveProperty('recommendedPace');
      expect(res.body.pedagogical).not.toHaveProperty('filledBy');
      expect(res.body.pedagogical).not.toHaveProperty('filledAt');
    });

    it('conserve les champs de structure dont le front a besoin', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);

      expect(res.body.userId).toBe(IDS.student1);
      expect(res.body.pedagogicalType).toBe('student');
      expect(res.body.administrative.userId).toBe(IDS.student1);
    });

    it('distingue « masqué » de « vide » : la clé est absente, jamais mise à null', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);

      // `avatarUrl` appartient au socle partagé et n'a jamais été renseigné :
      // la clé EXISTE et vaut null → « champ vide ».
      // `phone` est masqué : la clé N'EXISTE PAS et son nom est listé
      // dans hiddenFields → « champ masqué ».
      // Les deux cas sont donc distinguables sans aucune convention implicite.
      expect(res.body.administrative).toHaveProperty('avatarUrl', null);
      expect(res.body.visibility.hiddenFields).not.toContain('avatarUrl');

      expect(Object.keys(res.body.administrative)).not.toContain('phone');
      expect(res.body.visibility.hiddenFields).toContain('phone');
    });

    it('reste refusé en 403 quand il n\'est pas rattaché à l\'élève', async () => {
      await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${unlinkedTeacherToken}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Réglage dynamique : partager puis re-masquer
  // ---------------------------------------------------------------------------
  describe('changement de réglage', () => {
    it('rend un champ au formateur dès que l\'élève le passe à `linked`, puis le reprend', async () => {
      await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/field-visibility`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ fields: [{ fieldName: 'difficulties', audience: 'linked' }] })
        .expect(200);

      const shared = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);
      expect(shared.body.pedagogical.difficulties).toBe('Trigonométrie');
      expect(shared.body.visibility.hiddenFields).not.toContain('difficulties');

      // Retour à `self` : le champ redisparaît immédiatement.
      await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/field-visibility`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ fields: [{ fieldName: 'difficulties', audience: 'self' }] })
        .expect(200);

      const hiddenAgain = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);
      expect(hiddenAgain.body.pedagogical).not.toHaveProperty('difficulties');
      expect(hiddenAgain.body.visibility.hiddenFields).toContain('difficulties');
    });

    it('ne change RIEN pour le parent financeur, quel que soit le réglage', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.pedagogical.difficulties).toBe('Trigonométrie');
      expect(res.body.visibility.isFiltered).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Rôles administratifs — exemptés
  // ---------------------------------------------------------------------------
  describe('les rôles administratifs', () => {
    it.each([
      ['responsable_pedagogique', IDS.rp1],
      ['animateur_pedagogique', IDS.ap1],
      ['technicien_informatique', IDS.ti],
      ['administrateur_financier', IDS.adminFin],
    ])('exempte %s du filtrage', async (role, userId) => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${makeJwt(userId, role)}`)
        .expect(200);

      expect(res.body.pedagogical.difficulties).toBe('Trigonométrie');
      expect(res.body.administrative.phone).toBe('0600000000');
      expect(res.body.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
    });

    it('laisse le RP relire la prescription qu\'il vient d\'écrire', async () => {
      // Tous les champs de prescription étant `self` par défaut, un RP filtré
      // serait aveugle à la section dont il est l'auteur.
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${rpToken}`)
        .expect(200);

      expect(res.body.pedagogical.generalAssessment).toBe('Élève sérieuse');
      expect(res.body.pedagogical.filledBy).toBe(IDS.rp1);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /profiles/:userId/statistics — pas un contournement du filtrage
  // ---------------------------------------------------------------------------
  describe('GET /profiles/:userId/statistics', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/field-visibility`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ fields: [{ fieldName: 'level', audience: 'self' }] })
        .expect(200);
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/field-visibility`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ fields: [{ fieldName: 'level', audience: 'linked' }] })
        .expect(200);
    });

    it('applique le même filtrage que GET /profiles/:userId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${linkedTeacherToken}`)
        .expect(200);

      expect(res.body.statistics).not.toHaveProperty('level');
      expect(res.body.visibility.hiddenFields).toContain('level');
    });

    it('n\'applique aucun filtrage au parent financeur', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.statistics.level).toBe('3ème');
      expect(res.body.visibility.isFiltered).toBe(false);
    });

    it('rend ses statistiques entières au titulaire', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.statistics.level).toBe('3ème');
      expect(res.body.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
    });
  });

  // ---------------------------------------------------------------------------
  // Les routes /internal/* ne sont pas concernées
  // ---------------------------------------------------------------------------
  describe('routes internes', () => {
    it('ne filtre pas POST /internal/create-administrative-profile', async () => {
      // Ces routes servent des services, pas des utilisateurs finaux : elles
      // n'ont pas d'acteur authentifié et ne passent pas par getProfile.
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set(headers)
        .send({
          userId: IDS.student1,
          firstName: 'Alice',
          lastName: 'Dupont',
          phone: '0600000000',
        })
        .expect(201);

      expect(res.body.administrative.phone).toBe('0600000000');
      expect(res.body.administrative).not.toHaveProperty('visibility');
    });
  });
});

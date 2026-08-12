/**
 * E2E — Routes internes inter-services (/internal/*)
 *
 * Ces routes ne sont pas exposées via nginx (api-gateway).
 * Elles sont protégées par le header x-internal-secret (InternalGuard).
 * Utilisées par orchestration-service dans les workflows d'onboarding.
 *
 * Routes testées :
 *   POST /internal/create-administrative-profile
 *   POST /internal/create-student-profiles
 *   POST /internal/create-teacher-profiles
 *   POST /internal/link-parent
 *   POST /internal/create-teacher-student-relation
 *   POST /internal/link-coordinator
 *   GET  /internal/profiles/:userId/display-name
 *   POST /internal/profiles/display-names
 *
 * Source : docs/services/profile-service.md — section InternalController
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  identityAccessStub,
  makeJwt,
  INTERNAL_SECRET,
  IDS,
} from './helpers/app.helper';
import { DISPLAY_NAMES_BATCH_MAX_SIZE } from '../../src/internal/dto/resolve-display-names.dto';

const WRONG_SECRET = 'wrong_secret';

describe('[E2E] Internal routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // Security : InternalGuard
  // ──────────────────────────────────────────────────────────────

  describe('InternalGuard — sécurité x-internal-secret', () => {
    it('Sans header x-internal-secret → 401 ou 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .send({ userId: IDS.student1, firstName: 'Test', lastName: 'Test' });

      expect([401, 403]).toContain(res.status);
    });

    it('Avec un secret incorrect → 401 ou 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', WRONG_SECRET)
        .send({ userId: IDS.student1, firstName: 'Test', lastName: 'Test' });

      expect([401, 403]).toContain(res.status);
    });

    it('Ces routes ne doivent pas accepter un JWT Bearer standard', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('Authorization', 'Bearer some.jwt.token')
        .send({ userId: IDS.student1, firstName: 'Test', lastName: 'Test' });

      // Sans x-internal-secret, doit être rejeté même avec un JWT
      expect([401, 403]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/create-administrative-profile
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/create-administrative-profile', () => {
    it('Crée le profil administratif d\'un compte (élève, formateur, parent, générique) → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount1, firstName: 'Sophie', lastName: 'Bernard' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId', IDS.genericAccount1);
      expect(res.body).toHaveProperty('administrative');
      expect(res.body.administrative).toMatchObject({ firstName: 'Sophie', lastName: 'Bernard' });
    });

    it('Idempotence : rappel sur un userId déjà pourvu d\'un profil met à jour le nom au lieu de planter → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount1, firstName: 'SophieBis', lastName: 'BernardBis' });

      expect(res.status).toBe(201);
      expect(res.body.administrative).toMatchObject({ firstName: 'SophieBis', lastName: 'BernardBis' });
    });

    it('userId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ firstName: 'Sophie', lastName: 'Bernard' });

      expect(res.status).toBe(400);
    });

    it('firstName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount2, lastName: 'Bernard' });

      expect(res.status).toBe(400);
    });

    it('lastName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount2, firstName: 'Sophie' });

      expect(res.status).toBe(400);
    });

    it('firstName vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount2, firstName: '', lastName: 'Bernard' });

      expect(res.status).toBe(400);
    });

    it('phone vide (chaîne) → 400 (erreur de validation explicite, distincte d\'une erreur serveur)', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount2, firstName: 'Sophie', lastName: 'Bernard', phone: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('message');
    });

    it('phone trop long (> 20 caractères) → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          userId: IDS.genericAccount2,
          firstName: 'Sophie',
          lastName: 'Bernard',
          phone: '0'.repeat(21),
        });

      expect(res.status).toBe(400);
    });

    it('Sans header x-internal-secret → 401 ou 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .send({ userId: IDS.genericAccount2, firstName: 'Sophie', lastName: 'Bernard' });

      expect([401, 403]).toContain(res.status);
    });

    // ────────────────────────────────────────────────────────────
    // birthDate à la création — le champ existait en base et à la
    // modification, mais la création l'ignorait : il avait donc été retiré du
    // formulaire d'inscription faute d'être stocké nulle part. Ces tests
    // verrouillent le relais depuis identity-access-service.
    // ────────────────────────────────────────────────────────────

    it('Persiste birthDate fourni à la création → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          userId: IDS.birthDateAccount,
          firstName: 'Nadia',
          lastName: 'Leroy',
          birthDate: '2008-03-14',
        });

      expect(res.status).toBe(201);
      expect(res.body.administrative).toMatchObject({ birthDate: '2008-03-14' });
    });

    it('Idempotence : rappel avec une birthDate différente met à jour la date → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          userId: IDS.birthDateAccount,
          firstName: 'Nadia',
          lastName: 'Leroy',
          birthDate: '2008-04-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.administrative).toMatchObject({ birthDate: '2008-04-01' });
    });

    it('birthDate reste facultatif (comptes RP/TI/AF sans date de naissance) → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.rp1, firstName: 'Rachid', lastName: 'Pedago' });

      expect(res.status).toBe(201);
      expect(res.body.administrative.birthDate ?? null).toBeNull();
    });

    it('birthDate mal formée → 400, jamais absorbée en silence', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          userId: IDS.genericAccount2,
          firstName: 'Sophie',
          lastName: 'Bernard',
          birthDate: '14/03/2008',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('birthDate');
    });

    it('Persiste le champ phone (colonne `telephone` en base) à la création → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount2, firstName: 'Sophie', lastName: 'Bernard', phone: '+33601020304' });

      expect(res.status).toBe(201);
      expect(res.body.administrative).toMatchObject({
        firstName: 'Sophie',
        lastName: 'Bernard',
        phone: '+33601020304',
      });
    });

    it('Idempotence : rappel avec un phone différent met à jour le numéro → 201', async () => {
      await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount2, firstName: 'Sophie', lastName: 'Bernard', phone: '+33601020304' });

      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.genericAccount2, firstName: 'Sophie', lastName: 'Bernard', phone: '+33609080706' });

      expect(res.status).toBe(201);
      expect(res.body.administrative).toMatchObject({ phone: '+33609080706' });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/create-student-profiles
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/create-student-profiles', () => {
    it('Crée les profils administratif et pédagogique d\'un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId', IDS.student1);
      // Les deux types de profil doivent être créés ou confirmés
      expect(res.body).toHaveProperty('administrative');
      expect(res.body).toHaveProperty('pedagogical');
    });

    it('Idempotence : appel en double sur le même userId ne plante pas → 200 ou 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' });

      expect([200, 201, 409]).toContain(res.status);
    });

    it('userId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ firstName: 'Alice', lastName: 'Dupont' });

      expect(res.status).toBe(400);
    });

    it('firstName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student2, lastName: 'Dupont' });

      expect(res.status).toBe(400);
    });

    it('lastName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student2, firstName: 'Alice' });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/create-teacher-profiles
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/create-teacher-profiles', () => {
    it('Crée les profils administratif et pédagogique d\'un formateur → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.teacher1, firstName: 'Bob', lastName: 'Martin' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId', IDS.teacher1);
      expect(res.body).toHaveProperty('administrative');
      expect(res.body).toHaveProperty('pedagogical');
    });

    it('Le profil pédagogique formateur contient isAnimateurPedagogique à false par défaut', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.teacher2, firstName: 'Carol', lastName: 'Robert' });

      expect(res.status).toBe(201);
      // Pas de repli `?? res.body` : la forme de la réponse est justement ce
      // qu'on verrouille ici, un repli la rendrait indétectable.
      expect(res.body.pedagogical).toMatchObject(
        expect.objectContaining({ isAnimateurPedagogique: false }),
      );
    });

    it('userId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ firstName: 'Test' });

      expect(res.status).toBe(400);
    });

    it('firstName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.unknown, lastName: 'Martin' });

      expect(res.status).toBe(400);
    });

    it('lastName manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.unknown, firstName: 'Bob' });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/link-parent
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/link-parent', () => {
    it('Lie un parent à un élève → 201 avec champ contacts', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-parent')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ studentId: IDS.student1, financeOwnerId: IDS.parent1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('linked', true);
      expect(res.body).toHaveProperty('contacts');
      expect(res.body.contacts).toContain(IDS.parent1);
    });

    it('financeOwnerId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-parent')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ studentId: IDS.student1 });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/create-teacher-student-relation
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/create-teacher-student-relation', () => {
    it('Crée la relation formateur-élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-student-relation')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('teacherId', IDS.teacher1);
      expect(res.body).toHaveProperty('studentId', IDS.student1);
    });

    /**
     * Idempotence exigée le 2026-08-12 : rejouer la validation d'un RP ne doit
     * ni créer un second lien, ni échouer. Le `200` (et non `201`) dit que rien
     * n'a été créé — annoncer une création qui n'a pas eu lieu serait un
     * mensonge de la même famille que ceux corrigés les jours précédents.
     */
    it('Rejeu à l’identique → 200, même corps, et un seul lien en base', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-student-relation')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student1 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        teacherId: IDS.teacher1,
        studentId: IDS.student1,
        isPrincipalTeacher: false,
      });

      // Un seul lien, malgré deux appels : c'est ce que « idempotent » veut dire.
      const teachers = await request(app.getHttpServer())
        .get(`/relations/teacher-student/${IDS.student1}`)
        .set('Authorization', `Bearer ${makeJwt(IDS.rp1, 'responsable_pedagogique')}`);
      expect(teachers.status).toBe(200);
      expect(
        teachers.body.filter((link: { teacherId: string }) => link.teacherId === IDS.teacher1),
      ).toHaveLength(1);
    });

    it('Lien existant avec un professeur principal différent → 409 (ce n’est pas un rejeu)', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-student-relation')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student1, isPrincipalTeacher: true });

      expect(res.status).toBe(409);
    });

    it('teacherId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-student-relation')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ studentId: IDS.student1 });

      expect(res.status).toBe(400);
    });

    it('Sans x-internal-secret → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-student-relation')
        .send({ teacherId: IDS.teacher2, studentId: IDS.student2 });

      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // GET /internal/profiles/:userId/display-name
  // POST /internal/profiles/display-names
  //
  // Résolution de nom entre services (arbitrage du 2026-08-12). Servie sans
  // lecteur et sans filtrage champ par champ, d'où un périmètre volontairement
  // minuscule : prénom et nom, rien d'autre. Ces routes ne sont jamais exposées
  // par api-gateway.
  // ──────────────────────────────────────────────────────────────

  describe('GET /internal/profiles/:userId/display-name', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student2, firstName: 'Camille', lastName: 'Durand' });
    });

    it('Renvoie le nom, et UNIQUEMENT le nom → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/internal/profiles/${IDS.student2}/display-name`)
        .set('x-internal-secret', INTERNAL_SECRET)
        .set('x-correlation-id', 'corr-e2e-display-name');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        userId: IDS.student2,
        firstName: 'Camille',
        lastName: 'Durand',
      });
      /**
       * Garde-fou du contrat figé : aucun champ de plus ne doit jamais sortir
       * d'ici, sans quoi la route devient une porte dérobée contournant le
       * filtrage de visibilité pour tout service détenant INTERNAL_SECRET.
       */
      expect(Object.keys(res.body).sort()).toEqual(['firstName', 'lastName', 'userId']);
    });

    it('Sans x-internal-secret → 401', async () => {
      const res = await request(app.getHttpServer()).get(
        `/internal/profiles/${IDS.student2}/display-name`,
      );

      expect(res.status).toBe(401);
    });

    it('Avec un secret incorrect → 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/internal/profiles/${IDS.student2}/display-name`)
        .set('x-internal-secret', WRONG_SECRET);

      expect(res.status).toBe(401);
    });

    it('Un JWT ne remplace pas le secret interne → 401', async () => {
      const res = await request(app.getHttpServer())
        .get(`/internal/profiles/${IDS.student2}/display-name`)
        .set('Authorization', `Bearer ${makeJwt(IDS.rp1, 'responsable_pedagogique')}`);

      expect(res.status).toBe(401);
    });

    it('userId inconnu de identity-access-service → 404', async () => {
      identityAccessStub.markAccountUnknown(IDS.unknown);

      const res = await request(app.getHttpServer())
        .get(`/internal/profiles/${IDS.unknown}/display-name`)
        .set('x-internal-secret', INTERNAL_SECRET);

      expect(res.status).toBe(404);
    });

    it('Compte connu mais sans profil administratif → 500 (incohérence, jamais masquée)', async () => {
      identityAccessStub.registerAccount(
        IDS.accountWithoutAdminProfile,
        'compte.orphelin',
        'eleve',
      );

      const res = await request(app.getHttpServer())
        .get(`/internal/profiles/${IDS.accountWithoutAdminProfile}/display-name`)
        .set('x-internal-secret', INTERNAL_SECRET);

      expect(res.status).toBe(500);
    });

    it('userId non-UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/internal/profiles/pas-un-uuid/display-name')
        .set('x-internal-secret', INTERNAL_SECRET);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /internal/profiles/display-names', () => {
    it('Résout un lot en un seul appel → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/profiles/display-names')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userIds: [IDS.student2, IDS.genericAccount1] });

      expect(res.status).toBe(200);
      expect(res.body.displayNames).toEqual(
        expect.arrayContaining([
          { userId: IDS.student2, firstName: 'Camille', lastName: 'Durand' },
        ]),
      );
      res.body.displayNames.forEach((displayName: Record<string, unknown>) => {
        expect(Object.keys(displayName).sort()).toEqual(['firstName', 'lastName', 'userId']);
      });
    });

    it('Un userId sans profil est absent de la réponse, sans faire échouer le lot → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/profiles/display-names')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userIds: [IDS.student2, IDS.unknown] });

      expect(res.status).toBe(200);
      expect(res.body.displayNames).toHaveLength(1);
      expect(res.body.displayNames[0]).toHaveProperty('userId', IDS.student2);
    });

    it('Liste vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/profiles/display-names')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userIds: [] });

      expect(res.status).toBe(400);
    });

    it('Identifiant non-UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/profiles/display-names')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userIds: ['pas-un-uuid'] });

      expect(res.status).toBe(400);
    });

    it('Lot au-delà du plafond déclaré → 400', async () => {
      const tooManyUserIds = Array.from(
        { length: DISPLAY_NAMES_BATCH_MAX_SIZE + 1 },
        () => IDS.student2,
      );

      const res = await request(app.getHttpServer())
        .post('/internal/profiles/display-names')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userIds: tooManyUserIds });

      expect(res.status).toBe(400);
    });

    it('Sans x-internal-secret → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/profiles/display-names')
        .send({ userIds: [IDS.student2] });

      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POST /internal/link-coordinator
  // ──────────────────────────────────────────────────────────────

  describe('POST /internal/link-coordinator', () => {
    it('Lie un coordinateur (RP) à un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('coordinatorId', IDS.rp1);
      expect(res.body).toHaveProperty('studentId', IDS.student1);
    });

    it('Lie un coordinateur (AP) à un élève → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.ap1,
          studentId: IDS.student1,
          coordinatorRole: 'animateur_pedagogique',
        });

      expect(res.status).toBe(201);
    });

    it('Doublon coordinateur-élève → 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(409);
    });

    it('coordinatorRole invalide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          coordinatorId: IDS.rp1,
          studentId: IDS.student2,
          coordinatorRole: 'formateur', // rôle non autorisé
        });

      expect(res.status).toBe(400);
    });

    it('coordinatorId manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/link-coordinator')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({
          studentId: IDS.student1,
          coordinatorRole: 'responsable_pedagogique',
        });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Verrou de nommage — arbitrage du 2026-08-08
  // ──────────────────────────────────────────────────────────────

  /**
   * « Une même donnée porte un seul nom dans tout le système. Aucune route,
   * publique ou interne, n'a le droit d'exposer sa propre variante. »
   * (docs/architecture.md > "Arbitrages rendus", 2026-08-08)
   *
   * Les routes /internal/* renvoyaient historiquement `administrativeProfile`
   * / `pedagogicalProfile` là où les routes publiques renvoient
   * `administrative` / `pedagogical`. Cette paire longue a été supprimée sans
   * alias. Ces tests échouent si elle réapparaît, y compris sous forme d'alias
   * de compatibilité — c'est précisément ce qu'on interdit.
   */
  describe('Nommage des blocs de profil : `administrative` / `pedagogical` uniquement', () => {
    const FORBIDDEN_KEYS = ['administrativeProfile', 'pedagogicalProfile'];

    it('POST /internal/create-administrative-profile n\'expose pas la paire longue', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-administrative-profile')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.parent1, firstName: 'Nadia', lastName: 'Leroy' });

      expect(res.status).toBe(201);
      expect(Object.keys(res.body)).toEqual(expect.arrayContaining(['administrative']));
      for (const forbiddenKey of FORBIDDEN_KEYS) {
        expect(res.body).not.toHaveProperty(forbiddenKey);
      }
    });

    it('POST /internal/create-student-profiles n\'expose pas la paire longue', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-student-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.student2, firstName: 'Lina', lastName: 'Moreau' });

      expect(res.status).toBe(201);
      expect(Object.keys(res.body)).toEqual(
        expect.arrayContaining(['administrative', 'pedagogical']),
      );
      for (const forbiddenKey of FORBIDDEN_KEYS) {
        expect(res.body).not.toHaveProperty(forbiddenKey);
      }
    });

    it('POST /internal/create-teacher-profiles n\'expose pas la paire longue', async () => {
      const res = await request(app.getHttpServer())
        .post('/internal/create-teacher-profiles')
        .set('x-internal-secret', INTERNAL_SECRET)
        .send({ userId: IDS.teacher2, firstName: 'Carol', lastName: 'Robert' });

      expect(res.status).toBe(201);
      expect(Object.keys(res.body)).toEqual(
        expect.arrayContaining(['administrative', 'pedagogical']),
      );
      for (const forbiddenKey of FORBIDDEN_KEYS) {
        expect(res.body).not.toHaveProperty(forbiddenKey);
      }
    });

    it('aucune route /internal/* ne fait apparaître la paire longue, même en profondeur', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/internal/create-administrative-profile')
          .set('x-internal-secret', INTERNAL_SECRET)
          .send({ userId: IDS.genericAccount1, firstName: 'Sophie', lastName: 'Bernard' }),
        request(app.getHttpServer())
          .post('/internal/create-student-profiles')
          .set('x-internal-secret', INTERNAL_SECRET)
          .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' }),
        request(app.getHttpServer())
          .post('/internal/create-teacher-profiles')
          .set('x-internal-secret', INTERNAL_SECRET)
          .send({ userId: IDS.teacher1, firstName: 'Bob', lastName: 'Martin' }),
      ]);

      for (const response of responses) {
        const serializedBody = JSON.stringify(response.body);
        for (const forbiddenKey of FORBIDDEN_KEYS) {
          expect(serializedBody).not.toContain(forbiddenKey);
        }
      }
    });
  });
});

/**
 * E2E — Profiles CRUD & access control
 *
 * Critères couverts (source : docs/services/profile-service.md) :
 *   PROF-BR-001  Chaque élève possède un profil administratif
 *   PROF-BR-003  Chaque formateur possède un profil administratif
 *   PROF-BR-009  Les RP peuvent ajouter des commentaires internes
 *   PROF-BR-012  Vues partielles selon le rôle du lecteur
 *   PROF-RA-001  Un élève peut consulter/modifier ses propres profils
 *   PROF-RA-004  Un RP peut consulter les profils de son domaine
 *   PROF-FB-002  Les notes internes RP ne sont jamais visibles par clients/formateurs
 *   PROF-FB-003  Un formateur ne voit pas les profils d'élèves non liés
 *
 * Routes testées :
 *   GET  /profiles/:userId
 *   PUT  /profiles/:userId/administrative
 *   PUT  /profiles/:userId/pedagogical
 *   POST /profiles/:teacherId/ap-status
 *   POST /profiles/:userId/internal-notes
 *
 * Auth : JWT Bearer (type: "access") via JwtAuthGuard
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

describe('[E2E] Profiles', () => {
  let app: INestApplication;

  // Tokens pré-générés pour chaque rôle
  let studentToken: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let parentToken: string;
  let rpToken: string;
  let apToken: string;
  let adminFinToken: string;
  let tiToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    studentToken  = makeJwt(IDS.student1,  'eleve');
    teacher1Token = makeJwt(IDS.teacher1,  'formateur');
    teacher2Token = makeJwt(IDS.teacher2,  'formateur');
    parentToken   = makeJwt(IDS.parent1,   'parent_financeur');
    rpToken       = makeJwt(IDS.rp1,       'responsable_pedagogique');
    apToken       = makeJwt(IDS.ap1,       'animateur_pedagogique');
    adminFinToken = makeJwt(IDS.adminFin,  'administrateur_financier');
    tiToken       = makeJwt(IDS.ti,        'technicien_informatique');

    // Seed minimal via route interne : créer les profils nécessaires
    const headers = { 'x-internal-secret': INTERNAL_SECRET };

    await request(app.getHttpServer())
      .post('/internal/create-student-profiles')
      .set(headers)
      .send({ userId: IDS.student1, firstName: 'Alice', lastName: 'Dupont' });

    await request(app.getHttpServer())
      .post('/internal/create-teacher-profiles')
      .set(headers)
      .send({ userId: IDS.teacher1, firstName: 'Bob', lastName: 'Martin' });

    await request(app.getHttpServer())
      .post('/internal/create-teacher-profiles')
      .set(headers)
      .send({ userId: IDS.teacher2, firstName: 'Carol', lastName: 'Robert' });

    // Compte existant côté identity-access-service mais SANS profil
    // administratif : incohérence de données attendue en 500.
    // (aucun appel /internal/... : c'est justement l'absence de profil qu'on teste)

    // Compte avec profil administratif seul, sans profil pédagogique :
    // état normal attendu en 200 + pedagogical: null.
    await request(app.getHttpServer())
      .post('/internal/create-administrative-profile')
      .set(headers)
      .send({
        userId: IDS.accountWithoutPedaProfile,
        firstName: 'Sans',
        lastName: 'Pedago',
      });

    // Lier teacher1 à student1 pour les tests d'accès formateur
    await request(app.getHttpServer())
      .post('/internal/create-teacher-student-relation')
      .set(headers)
      .send({ teacherId: IDS.teacher1, studentId: IDS.student1 });

    // État côté identity-access-service (stub e2e) : quels userId existent,
    // lequel est inconnu. C'est ce signal qui pilote 404 / 500 / 200.
    identityAccessStub.registerAccount(IDS.student1, 'alice.dupont', 'eleve');
    identityAccessStub.registerAccount(IDS.teacher1, 'bob.martin', 'formateur');
    identityAccessStub.registerAccount(IDS.teacher2, 'carol.robert', 'formateur');
    identityAccessStub.registerAccount(
      IDS.accountWithoutAdminProfile,
      'compte.sans.profil',
      'eleve',
    );
    identityAccessStub.registerAccount(
      IDS.accountWithoutPedaProfile,
      'sans.pedago',
      'eleve',
    );
    identityAccessStub.markAccountUnknown(IDS.unknown);
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────
  // Authentication guard
  // ──────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('GET /profiles/:userId — 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`);
      expect(res.status).toBe(401);
    });

    it('GET /profiles/:userId — 401 with malformed token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', 'Bearer not.a.real.token');
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // PROF-BR-001 / PROF-BR-003 — Lecture de profil (rôles autorisés)
  // ──────────────────────────────────────────────────────────────

  describe('GET /profiles/:userId — lecture de profil (PROF-BR-001, PROF-BR-003)', () => {
    it('[PROF-RA-001] Un élève peut lire son propre profil → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId', IDS.student1);
    });

    it('Un RP peut lire le profil d\'un élève → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId', IDS.student1);
    });

    it('Un TI peut lire n\'importe quel profil → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${tiToken}`);

      expect(res.status).toBe(200);
    });

    it('[PROF-RA-003] Un formateur lié peut lire le profil de l\'élève → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
    });

    it('[PROF-FB-003] Un formateur NON lié ne peut pas lire le profil d\'un élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(403);
    });

    it('Retourne 404 quand identity-access-service ne connaît pas le userId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Lecture strictement en lecture seule — docs/architecture.md,
  // arbitrages du 2026-08-07 :
  //   userId inconnu                         → 404
  //   compte existant sans profil administratif → 500 (incohérence de données)
  //   profil pédagogique absent              → 200 + pedagogical: null (normal)
  // Une consultation n'écrit JAMAIS en base.
  // ──────────────────────────────────────────────────────────────

  describe('GET /profiles/:userId — lecture sans création à la volée', () => {
    it('Compte existant sans profil administratif → 500 (incohérence de données)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.accountWithoutAdminProfile}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(500);
    });

    it('Le 500 ne crée aucun profil administratif fantôme : la lecture reste en 500', async () => {
      await request(app.getHttpServer())
        .get(`/profiles/${IDS.accountWithoutAdminProfile}`)
        .set('Authorization', `Bearer ${rpToken}`);

      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.accountWithoutAdminProfile}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(500);
    });

    it('Profil administratif présent mais pédagogique absent → 200 avec pedagogical: null', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.accountWithoutPedaProfile}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId', IDS.accountWithoutPedaProfile);
      expect(res.body.administrative).toMatchObject({ firstName: 'Sans', lastName: 'Pedago' });
      expect(res.body.pedagogical).toBeNull();
    });

    it("Aucune ligne pédagogique fantôme n'est écrite : la 2e lecture renvoie encore null", async () => {
      const ownerToken = makeJwt(IDS.accountWithoutPedaProfile, 'eleve');

      // Première lecture par le propriétaire lui-même : c'est ce cas précis qui
      // déclenchait l'ancien lazy-init du profil pédagogique élève.
      const first = await request(app.getHttpServer())
        .get(`/profiles/${IDS.accountWithoutPedaProfile}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(first.status).toBe(200);
      expect(first.body.pedagogical).toBeNull();

      // Relecture par un RP : si la première lecture avait créé une ligne,
      // elle apparaîtrait ici.
      const second = await request(app.getHttpServer())
        .get(`/profiles/${IDS.accountWithoutPedaProfile}`)
        .set('Authorization', `Bearer ${rpToken}`);
      expect(second.status).toBe(200);
      expect(second.body.pedagogical).toBeNull();
    });

    it('Le profil pédagogique est créé au premier PUT de l\'utilisateur, pas à la lecture', async () => {
      const ownerToken = makeJwt(IDS.accountWithoutPedaProfile, 'eleve');

      const put = await request(app.getHttpServer())
        .put(`/profiles/${IDS.accountWithoutPedaProfile}/pedagogical`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ niveauScolaire: '1ere' });
      expect(put.status).toBe(200);

      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.accountWithoutPedaProfile}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pedagogical).toMatchObject({ niveauScolaire: '1ere' });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // PROF-BR-001 — Modification du profil administratif
  // ──────────────────────────────────────────────────────────────

  describe('PUT /profiles/:userId/administrative (PROF-BR-001, PROF-RA-001)', () => {
    it('[PROF-RA-001] Un élève peut modifier son propre profil administratif → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/administrative`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ phone: '0601020304', ville: 'Paris' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId', IDS.student1);
    });

    it('Un RP peut modifier le profil administratif d\'un élève → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/administrative`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ ville: 'Lyon' });

      expect(res.status).toBe(200);
    });

    it('Un élève ne peut pas modifier le profil d\'un autre utilisateur → 403', async () => {
      const otherStudentToken = makeJwt(IDS.student2, 'eleve');
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/administrative`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ ville: 'Marseille' });

      expect(res.status).toBe(403);
    });

    it('Sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/administrative`)
        .send({ city: 'Nice' });

      expect(res.status).toBe(401);
    });

    it('firstName vide (\'\') → 400', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/administrative`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ firstName: '' });

      expect(res.status).toBe(400);
    });

    it('lastName vide (\'\') → 400', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/administrative`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ lastName: '' });

      expect(res.status).toBe(400);
    });

    it('firstName absent du body → 200, le champ existant n\'est pas modifié', async () => {
      const before = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${studentToken}`);

      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/administrative`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ phone: '0611223344' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe(before.body.administrativeProfile?.firstName ?? 'Alice');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // PROF-BR-002 / PROF-BR-004 — Modification du profil pédagogique
  // ──────────────────────────────────────────────────────────────

  describe('PUT /profiles/:userId/pedagogical (PROF-BR-002, PROF-BR-004)', () => {
    it('Un élève peut modifier son propre profil pédagogique → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/pedagogical`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ niveauScolaire: '3eme', objectifsPedagogiques: 'Reussir le brevet' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId', IDS.student1);
    });

    it('Un formateur peut modifier son propre profil pédagogique → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.teacher1}/pedagogical`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ experiencePedagogique: '5 ans', matieresEnseignees: ['algebre', 'geometrie'] });

      expect(res.status).toBe(200);
    });

    it('Un formateur ne peut pas modifier le profil pédagogique d\'un élève → 403', async () => {
      const res = await request(app.getHttpServer())
        .put(`/profiles/${IDS.student1}/pedagogical`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ niveauScolaire: '2nde' });

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // PROF-BR-008 — Promotion AP
  // ──────────────────────────────────────────────────────────────

  describe('POST /profiles/:teacherId/ap-status (PROF-BR-008, PROF-RA-004)', () => {
    it('[PROF-RA-004] Un RP peut promouvoir un formateur en AP → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.teacher1}/ap-status`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('isAnimateurPedagogique', true);
    });

    it('Après promotion, le statut AP apparaît dans le profil pédagogique → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.teacher1}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      // Le profil pédagogique formateur doit refléter isAnimateurPedagogique: true
      const teacherPedagogical = res.body.pedagogical ?? res.body;
      expect(teacherPedagogical).toMatchObject(
        expect.objectContaining({ isAnimateurPedagogique: true }),
      );
    });

    it('Un formateur (AP ou non) ne peut pas promouvoir → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.teacher2}/ap-status`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('Un parent ne peut pas promouvoir un formateur → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.teacher2}/ap-status`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // PROF-BR-009 / PROF-FB-002 — Notes internes RP
  // ──────────────────────────────────────────────────────────────

  describe('POST /profiles/:userId/internal-notes (PROF-BR-009, PROF-FB-002)', () => {
    it('[PROF-BR-009] Un RP peut ajouter une note interne → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.student1}/internal-notes`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ content: 'Eleve en difficulte en algebre' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('content', 'Eleve en difficulte en algebre');
      expect(res.body).toHaveProperty('authorId', IDS.rp1);
    });

    // ⚠️ TEST EN ÉCHEC ASSUMÉ — en attente d'arbitrage produit sur PROF-BR-010.
    //
    // Contradiction non tranchée :
    //   - docs/acceptance-criteria.md:37 (marqué [SPEC]) : « PROF-BR-010 — Un
    //     administrateur financier peut créer une note interne sur les profils
    //     formateurs/financiers (→ 201) » ;
    //   - le code actuel (NOTES_WRITE_ROLES dans src/profiles/profiles.service.ts)
    //     n'autorise l'écriture de note interne qu'au RP et à l'AP, et répond donc
    //     403 à l'administrateur financier. L'AF garde en revanche le droit de
    //     LECTURE (NOTES_READ_ROLES), ce qui rend l'asymétrie volontaire côté code.
    //
    // Tant que l'arbitrage n'est pas rendu, ce test reste rouge à dessein : ni le
    // test ni NOTES_WRITE_ROLES ne doivent être modifiés « pour faire passer la
    // suite ». Selon l'arbitrage, il faudra soit ajouter ADMINISTRATEUR_FINANCIER
    // à NOTES_WRITE_ROLES, soit corriger docs/acceptance-criteria.md:37 et
    // transformer ce test en attente de 403.
    it('[PROF-BR-010] Un administrateur financier peut ajouter une note interne → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.teacher1}/internal-notes`)
        .set('Authorization', `Bearer ${adminFinToken}`)
        .send({ content: 'Remuneration a verifier' });

      expect(res.status).toBe(201);
    });

    it('[PROF-FB-002] Un élève ne peut pas créer une note interne → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.student1}/internal-notes`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Auto-note' });

      expect(res.status).toBe(403);
    });

    it('[PROF-FB-002] Un parent ne peut pas créer une note interne → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.student1}/internal-notes`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ content: 'Note parent' });

      expect(res.status).toBe(403);
    });

    it('[PROF-FB-002] Un formateur ne peut pas créer une note interne → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.student1}/internal-notes`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ content: 'Note formateur' });

      expect(res.status).toBe(403);
    });

    it('[PROF-FB-002] Les notes internes ne sont PAS visibles dans GET /profiles (élève)', async () => {
      // D'abord, s'assurer qu'une note existe
      await request(app.getHttpServer())
        .post(`/profiles/${IDS.student1}/internal-notes`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ content: 'Note confidentielle RP' });

      // Lecture du profil par l'élève : ne doit PAS contenir internalNotes
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('internalNotes');
    });

    it('[PROF-FB-002] Les notes internes ne sont PAS visibles dans GET /profiles (formateur lié)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('internalNotes');
    });

    it('Body vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/profiles/${IDS.student1}/internal-notes`)
        .set('Authorization', `Bearer ${rpToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

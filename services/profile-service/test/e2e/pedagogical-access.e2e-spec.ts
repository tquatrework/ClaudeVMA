/**
 * E2E — « la relation ouvre le droit » (arbitrage du 2026-08-11)
 *
 * Trois surfaces, une seule règle :
 *   GET /profiles/:userId/statistics            — droit piloté par la relation
 *   GET /relations/my-contacts                  — qui puis-je consulter, par son NOM
 *   GET /internal/relations/:viewerId/:targetId — contrat consommé par
 *                                                 archive-document-service
 *   POST /relations/animator-teacher            — la relation AP → formateur,
 *                                                 sans laquelle la règle serait
 *                                                 inapplicable à l'AP
 *
 * Le graphe de test :
 *   parent1  finance  student1  et  student2
 *   teacher1 enseigne student1  (professeur principal)
 *   teacher2 n'enseigne à personne
 *   ap1      anime    teacher1
 *   parent1 ↔ teacher1 : lien INDIRECT, par student1
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, INTERNAL_SECRET, IDS } from './helpers/app.helper';
import { RelationKind } from '../../src/relations/relation-kind';

describe('[E2E] Accès pédagogique piloté par la relation', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  let rpToken: string;
  let tiToken: string;
  let afToken: string;
  let parentToken: string;
  let student1Token: string;
  let student2Token: string;
  let teacher1Token: string;
  let teacher2Token: string;
  let apToken: string;

  const internalHeaders = { 'x-internal-secret': INTERNAL_SECRET };

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    rpToken       = makeJwt(IDS.rp1,      'responsable_pedagogique');
    tiToken       = makeJwt(IDS.ti,       'technicien_informatique');
    afToken       = makeJwt(IDS.adminFin, 'administrateur_financier');
    parentToken   = makeJwt(IDS.parent1,  'parent_financeur');
    student1Token = makeJwt(IDS.student1, 'eleve');
    student2Token = makeJwt(IDS.student2, 'eleve');
    teacher1Token = makeJwt(IDS.teacher1, 'formateur');
    teacher2Token = makeJwt(IDS.teacher2, 'formateur');
    apToken       = makeJwt(IDS.ap1,      'animateur_pedagogique');

    await request(server)
      .post('/internal/create-student-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.student1, firstName: 'Théo', lastName: 'Relation', level: '3e' });
    await request(server)
      .post('/internal/create-student-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.student2, firstName: 'Nina', lastName: 'Autre', level: '5e' });
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.teacher1, firstName: 'Farid', lastName: 'Formateur', levels: ['3e'] });
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.teacher2, firstName: 'Sans', lastName: 'Eleve', levels: ['Terminale'] });

    await request(server)
      .post('/internal/link-parent')
      .set(internalHeaders)
      .send({ studentId: IDS.student1, financeOwnerId: IDS.parent1 });
    await request(server)
      .post('/internal/link-parent')
      .set(internalHeaders)
      .send({ studentId: IDS.student2, financeOwnerId: IDS.parent1 });
    await request(server)
      .post('/internal/create-teacher-student-relation')
      .set(internalHeaders)
      .send({ teacherId: IDS.teacher1, studentId: IDS.student1, isPrincipalTeacher: true });

    await request(server)
      .post('/relations/animator-teacher')
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ animatorId: IDS.ap1, teacherId: IDS.teacher1 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /profiles/:userId/statistics — cas nominaux
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /profiles/:userId/statistics — la relation ouvre le droit', () => {
    it('le titulaire lit ses propres statistiques, sans filtrage', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.visibility.isFiltered).toBe(false);
    });

    it('le formateur lit les statistiques de SON élève', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.profileType).toBe('student');
    });

    it("l'élève lit les statistiques de SON formateur — nouveau droit, symétrique", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.teacher1}/statistics`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.profileType).toBe('teacher');
      // Lié, donc soumis aux réglages du formateur.
      expect(res.body.visibility.isFiltered).toBe(true);
    });

    it('le parent financeur lit les statistiques de SON élève, sans filtrage', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.visibility.isFiltered).toBe(false);
    });

    it("le parent lit les statistiques du formateur de son élève — lien indirect, mais filtré", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.teacher1}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.visibility.isFiltered).toBe(true);
    });

    it("l'AP lit les statistiques du formateur qu'il anime, sans filtrage", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.teacher1}/statistics`)
        .set('Authorization', `Bearer ${apToken}`);

      expect(res.status).toBe(200);
      expect(res.body.visibility.isFiltered).toBe(false);
    });

    it.each([
      ['responsable_pedagogique', () => rpToken],
      ['technicien_informatique', () => tiToken],
      ['administrateur_financier', () => afToken],
    ])('%s lit les statistiques de n\'importe qui, sans relation', async (_role, token) => {
      for (const targetId of [IDS.student1, IDS.student2, IDS.teacher1, IDS.teacher2]) {
        const res = await request(server)
          .get(`/profiles/${targetId}/statistics`)
          .set('Authorization', `Bearer ${token()}`);
        expect(res.status).toBe(200);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /profiles/:userId/statistics — cas d'erreur
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /profiles/:userId/statistics — refus', () => {
    it.each([
      ['formateur sans lien avec cet élève', () => teacher2Token, () => IDS.student1],
      ['formateur sans lien avec cet autre formateur', () => teacher2Token, () => IDS.teacher1],
      ['élève sur un autre élève', () => student1Token, () => IDS.student2],
      ['élève sur un formateur qui n\'est pas le sien', () => student2Token, () => IDS.teacher1],
      ['parent sur un formateur sans élève commun', () => parentToken, () => IDS.teacher2],
      ['AP sur un formateur qu\'il n\'anime pas', () => apToken, () => IDS.teacher2],
    ])('refuse %s en 404, jamais en 403', async (_label, token, targetId) => {
      const res = await request(server)
        .get(`/profiles/${targetId()}/statistics`)
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(404);
    });

    it('un refus est indiscernable d\'une absence de statistiques — même code, même message', async () => {
      // Personne SANS profil pédagogique, lue par un administrateur : la vraie absence.
      await request(server)
        .post('/internal/create-administrative-profile')
        .set(internalHeaders)
        .send({ userId: IDS.genericAccount1, firstName: 'Sans', lastName: 'Pedago' });

      const missing = await request(server)
        .get(`/profiles/${IDS.genericAccount1}/statistics`)
        .set('Authorization', `Bearer ${rpToken}`);

      const denied = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(missing.status).toBe(404);
      expect(denied.status).toBe(404);
      expect(denied.body.message.replace(IDS.student1, 'X')).toBe(
        missing.body.message.replace(IDS.genericAccount1, 'X'),
      );
    });

    it('sans jeton → 401', async () => {
      const res = await request(server).get(`/profiles/${IDS.student1}/statistics`);
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /relations/my-contacts
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /relations/my-contacts', () => {
    it('le formateur reçoit SES élèves, avec leur nom — jamais un simple UUID', async () => {
      const res = await request(server)
        .get('/relations/my-contacts')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(200);
      const student = res.body.find((person: any) => person.userId === IDS.student1);
      expect(student).toMatchObject({ firstName: 'Théo', lastName: 'Relation' });
      expect(student.relations).toContainEqual({
        kind: RelationKind.TEACHER_OF_STUDENT,
        isPrincipalTeacher: true,
      });
    });

    it('le formateur reçoit aussi le parent financeur de son élève (lien indirect)', async () => {
      const res = await request(server)
        .get('/relations/my-contacts')
        .set('Authorization', `Bearer ${teacher1Token}`);

      const parent = res.body.find((person: any) => person.userId === IDS.parent1);
      expect(parent.relations[0].kind).toBe(RelationKind.TEACHER_OF_STUDENT_OF_FINANCE_OWNER);
      expect(parent.relations[0].throughUserIds).toEqual([IDS.student1]);
    });

    it('le parent reçoit ses deux élèves ET le formateur de son élève', async () => {
      const res = await request(server)
        .get('/relations/my-contacts')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      const userIds = res.body.map((person: any) => person.userId);
      expect(userIds).toEqual(
        expect.arrayContaining([IDS.student1, IDS.student2, IDS.teacher1]),
      );
      expect(userIds).not.toContain(IDS.teacher2);
    });

    it("l'élève reçoit son formateur et son parent financeur", async () => {
      const res = await request(server)
        .get('/relations/my-contacts')
        .set('Authorization', `Bearer ${student1Token}`);

      const kinds = res.body.flatMap((person: any) =>
        person.relations.map((relation: any) => relation.kind),
      );
      expect(kinds).toEqual(
        expect.arrayContaining([
          RelationKind.STUDENT_OF_TEACHER,
          RelationKind.STUDENT_OF_FINANCE_OWNER,
        ]),
      );
    });

    it("l'AP reçoit le formateur qu'il anime", async () => {
      const res = await request(server)
        .get('/relations/my-contacts')
        .set('Authorization', `Bearer ${apToken}`);

      expect(res.body).toEqual([
        expect.objectContaining({
          userId: IDS.teacher1,
          relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
        }),
      ]);
    });

    it('un compte sans aucun lien reçoit 200 [] — jamais une erreur', async () => {
      const res = await request(server)
        .get('/relations/my-contacts')
        .set('Authorization', `Bearer ${teacher2Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('sans jeton → 401', async () => {
      const res = await request(server).get('/relations/my-contacts');
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /relations/animator-teacher
  // ──────────────────────────────────────────────────────────────────────────
  describe('POST /relations/animator-teacher', () => {
    it('doublon → 409', async () => {
      const res = await request(server)
        .post('/relations/animator-teacher')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ animatorId: IDS.ap1, teacherId: IDS.teacher1 });

      expect(res.status).toBe(409);
    });

    it("un AP ne se donne pas ses propres animés → 403", async () => {
      const res = await request(server)
        .post('/relations/animator-teacher')
        .set('Authorization', `Bearer ${apToken}`)
        .send({ animatorId: IDS.ap1, teacherId: IDS.teacher2 });

      expect(res.status).toBe(403);
    });

    it('body incomplet → 400', async () => {
      const res = await request(server)
        .post('/relations/animator-teacher')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ animatorId: IDS.ap1 });

      expect(res.status).toBe(400);
    });

    it('sans jeton → 401', async () => {
      const res = await request(server)
        .post('/relations/animator-teacher')
        .send({ animatorId: IDS.ap1, teacherId: IDS.teacher2 });

      expect(res.status).toBe(401);
    });

    it("GET /relations/animator-teacher/:animatorId renvoie les formateurs animés, avec leur nom", async () => {
      const res = await request(server)
        .get(`/relations/animator-teacher/${IDS.ap1}`)
        .set('Authorization', `Bearer ${apToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        expect.objectContaining({
          teacherId: IDS.teacher1,
          teacherName: { firstName: 'Farid', lastName: 'Formateur' },
        }),
      ]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /internal/relations/:viewerId/:targetId — contrat interservices
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /internal/relations/:viewerId/:targetId', () => {
    const call = (viewerId: string, targetId: string, viewerRole?: string) => {
      const query = viewerRole === undefined ? '' : `?viewerRole=${viewerRole}`;
      return request(server).get(`/internal/relations/${viewerId}/${targetId}${query}`);
    };

    it('renvoie la NATURE et le SENS du lien, pas un booléen', async () => {
      const res = await call(IDS.teacher1, IDS.student1, 'formateur').set(internalHeaders);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        viewerId: IDS.teacher1,
        targetId: IDS.student1,
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true }],
      });
    });

    it('distingue les deux sens du même lien — ce qui permet à l\'appelant de trancher', async () => {
      const forward = await call(IDS.student1, IDS.teacher1, 'eleve').set(internalHeaders);
      expect(forward.body.relations[0].kind).toBe(RelationKind.STUDENT_OF_TEACHER);

      const backward = await call(IDS.teacher1, IDS.student1, 'formateur').set(internalHeaders);
      expect(backward.body.relations[0].kind).toBe(RelationKind.TEACHER_OF_STUDENT);
    });

    it('distingue parent↔élève, formateur↔élève et AP↔formateur', async () => {
      const parentStudent = await call(IDS.parent1, IDS.student1, 'parent_financeur').set(internalHeaders);
      expect(parentStudent.body.relations[0].kind).toBe(RelationKind.FINANCE_OWNER_OF_STUDENT);

      const apTeacher = await call(IDS.ap1, IDS.teacher1, 'animateur_pedagogique').set(internalHeaders);
      expect(apTeacher.body.relations[0].kind).toBe(RelationKind.ANIMATOR_OF_TEACHER);
    });

    it('signale le lien indirect parent ↔ formateur avec l\'élève commun', async () => {
      const res = await call(IDS.parent1, IDS.teacher1, 'parent_financeur').set(internalHeaders);

      expect(res.body.relations).toEqual([
        {
          kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER,
          throughUserIds: [IDS.student1],
        },
      ]);
    });

    it('signale le titulaire par isSelf, sans inventer de relation', async () => {
      const res = await call(IDS.student1, IDS.student1, 'eleve').set(internalHeaders);
      expect(res.body).toMatchObject({ isSelf: true, relations: [] });
    });

    it.each([
      ['responsable_pedagogique'],
      ['administrateur_financier'],
      ['technicien_informatique'],
    ])('signale %s comme administrateur, même sans relation', async (role) => {
      const res = await call(IDS.rp1, IDS.student1, role).set(internalHeaders);
      expect(res.body).toMatchObject({ isAdministrator: true, relations: [] });
    });

    it("ne compte pas l'animateur pédagogique parmi les administrateurs", async () => {
      const res = await call(IDS.ap1, IDS.student1, 'animateur_pedagogique').set(internalHeaders);
      expect(res.body).toMatchObject({ isAdministrator: false, relations: [] });
    });

    it('renvoie une liste vide pour deux personnes sans lien', async () => {
      const res = await call(IDS.teacher2, IDS.student1, 'formateur').set(internalHeaders);
      expect(res.body.relations).toEqual([]);
    });

    it('viewerRole absent → 400 : le rôle accompagne systématiquement les appels interservices', async () => {
      const res = await call(IDS.teacher1, IDS.student1).set(internalHeaders);
      expect(res.status).toBe(400);
    });

    it('viewerRole inconnu → 400, jamais un « pas administrateur » silencieux', async () => {
      const res = await call(IDS.teacher1, IDS.student1, 'sorcier').set(internalHeaders);
      expect(res.status).toBe(400);
    });

    it('identifiant non-UUID → 400', async () => {
      const res = await call('pas-un-uuid', IDS.student1, 'formateur').set(internalHeaders);
      expect(res.status).toBe(400);
    });

    it('sans X-Internal-Secret → 401', async () => {
      const res = await call(IDS.teacher1, IDS.student1, 'formateur');
      expect(res.status).toBe(401);
    });

    it('avec un mauvais X-Internal-Secret → 401', async () => {
      const res = await call(IDS.teacher1, IDS.student1, 'formateur').set({
        'x-internal-secret': 'mauvais-secret',
      });
      expect(res.status).toBe(401);
    });
  });
});

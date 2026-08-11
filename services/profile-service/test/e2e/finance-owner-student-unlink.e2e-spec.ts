/**
 * E2E — « Délier » un parent financeur et un élève (besoin du 2026-08-11)
 *
 * Route testée :
 *   DELETE /relations/finance-owner-student/:financeOwnerId/:studentId
 *
 * Ce que cette suite doit prouver, au-delà du code retour :
 *   1. la rupture REFERME les droits ouverts par la relation — profil,
 *      statistiques, et `/internal/relations` consommé par
 *      archive-document-service ;
 *   2. elle n'efface rien : la ligne reste en base avec `endedAt`/`endedBy` ;
 *   3. elle est idempotente et ne réécrit pas la date de rupture initiale ;
 *   4. un tiers ne peut pas s'en servir pour découvrir qui finance qui ;
 *   5. un nouveau rattachement reste possible ensuite, par le parcours normal
 *      (`POST /parent-link-requests` puis approbation par l'élève).
 *
 * Le graphe de test :
 *   parent1 finance student1 ET student2
 *   teacher1 n'enseigne à personne — c'est le tiers non concerné
 */

import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import {
  createTestApp,
  makeJwt,
  INTERNAL_SECRET,
  IDS,
  identityAccessStub,
} from './helpers/app.helper';
import { RelationKind } from '../../src/relations/relation-kind';
import { FinanceOwnerStudentLink } from '../../src/relations/entities/finance-owner-student-link.entity';

describe('[E2E] Délier un parent financeur et un élève', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let financeLinkRepo: Repository<FinanceOwnerStudentLink>;

  let parentToken: string;
  let student1Token: string;
  let student2Token: string;
  let teacherToken: string;
  let rpToken: string;
  let afToken: string;

  const internalHeaders = { 'x-internal-secret': INTERNAL_SECRET };

  /** Chemin de la rupture, écrit une seule fois. */
  const unlinkPath = (financeOwnerId: string, studentId: string) =>
    `/relations/finance-owner-student/${financeOwnerId}/${studentId}`;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    financeLinkRepo = app.get<Repository<FinanceOwnerStudentLink>>(
      getRepositoryToken(FinanceOwnerStudentLink),
    );

    parentToken   = makeJwt(IDS.parent1,  'parent_financeur');
    student1Token = makeJwt(IDS.student1, 'eleve');
    student2Token = makeJwt(IDS.student2, 'eleve');
    teacherToken  = makeJwt(IDS.teacher1, 'formateur');
    rpToken       = makeJwt(IDS.rp1,      'responsable_pedagogique');
    afToken       = makeJwt(IDS.adminFin, 'administrateur_financier');

    // identity-access-service connaît ces comptes : nécessaire pour la lecture
    // de profil (404 si le compte est inconnu) et pour la résolution du
    // loginIdentifier lors du nouveau rattachement.
    identityAccessStub.registerAccount(IDS.student1, 'theo.eleve', 'eleve');
    identityAccessStub.registerAccount(IDS.student2, 'nina.eleve', 'eleve');
    identityAccessStub.registerAccount(IDS.parent1, 'paul.parent', 'parent_financeur');

    await request(server)
      .post('/internal/create-student-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.student1, firstName: 'Théo', lastName: 'Delié', level: '3e' });
    await request(server)
      .post('/internal/create-student-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.student2, firstName: 'Nina', lastName: 'Restante', level: '5e' });
    await request(server)
      .post('/internal/create-teacher-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.teacher1, firstName: 'Farid', lastName: 'Formateur', levels: ['3e'] });
    await request(server)
      .post('/internal/create-administrative-profile')
      .set(internalHeaders)
      .send({ userId: IDS.parent1, firstName: 'Paul', lastName: 'Parent', role: 'parent_financeur' });

    await request(server)
      .post('/internal/link-parent')
      .set(internalHeaders)
      .send({ studentId: IDS.student1, financeOwnerId: IDS.parent1 })
      .expect(201);
    await request(server)
      .post('/internal/link-parent')
      .set(internalHeaders)
      .send({ studentId: IDS.student2, financeOwnerId: IDS.parent1 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // État initial : le lien ouvre bien les droits qu'on va voir se refermer
  // ──────────────────────────────────────────────────────────────────────────
  describe('avant la rupture — le lien ouvre les droits', () => {
    it('le parent lit le profil de son élève', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
    });

    it('le parent lit les statistiques de son élève', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
    });

    it('archive-document-service voit la relation par la route interne', async () => {
      const res = await request(server)
        .get(`/internal/relations/${IDS.parent1}/${IDS.student1}?viewerRole=parent_financeur`)
        .set(internalHeaders);
      expect(res.status).toBe(200);
      expect(res.body.relations).toEqual([{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Refus — un tiers ne découvre rien
  // ──────────────────────────────────────────────────────────────────────────
  describe('qui peut délier', () => {
    it('un tiers non concerné reçoit 404, identique à un lien inexistant', async () => {
      const refused = await request(server)
        .delete(unlinkPath(IDS.parent1, IDS.student1))
        .set('Authorization', `Bearer ${teacherToken}`);
      const absent = await request(server)
        .delete(unlinkPath(IDS.parent1, IDS.teacher2))
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(refused.status).toBe(404);
      expect(absent.status).toBe(404);
      // Indiscernables : c'est ce qui empêche d'utiliser la route comme oracle.
      expect(refused.body.message).toBe(absent.body.message);
    });

    it("l'administrateur financier ne délie pas — il constate", async () => {
      const res = await request(server)
        .delete(unlinkPath(IDS.parent1, IDS.student1))
        .set('Authorization', `Bearer ${afToken}`);
      expect(res.status).toBe(404);
    });

    it('un refus ne rompt rien : le lien est toujours actif', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // La rupture, par le parent — et ce qu'elle referme
  // ──────────────────────────────────────────────────────────────────────────
  describe('rupture par le parent financeur', () => {
    let endedAtFirstCall: string;

    it('délie et renvoie la ligne rompue', async () => {
      const res = await request(server)
        .delete(unlinkPath(IDS.parent1, IDS.student1))
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.financeOwnerId).toBe(IDS.parent1);
      expect(res.body.studentId).toBe(IDS.student1);
      expect(res.body.endedAt).not.toBeNull();
      expect(res.body.endedBy).toBe(IDS.parent1);
      endedAtFirstCall = res.body.endedAt;
    });

    it("n'efface rien : la ligne reste en base, horodatée et signée", async () => {
      const rows = await financeLinkRepo.find({
        where: { financeOwnerId: IDS.parent1, studentId: IDS.student1 },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].endedAt).toBeInstanceOf(Date);
      expect(rows[0].endedBy).toBe(IDS.parent1);
    });

    it('referme la lecture du PROFIL de l\'ex-élève', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });

    it('referme les STATISTIQUES de l\'ex-élève', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(404);
    });

    it('referme les ARCHIVES pédagogiques — plus aucune relation résolue', async () => {
      const res = await request(server)
        .get(`/internal/relations/${IDS.parent1}/${IDS.student1}?viewerRole=parent_financeur`)
        .set(internalHeaders);
      expect(res.status).toBe(200);
      expect(res.body.relations).toEqual([]);
    });

    it('retire l\'ex-élève des listes, des deux côtés', async () => {
      const asParent = await request(server)
        .get(`/relations/finance-owner-student/${IDS.parent1}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(asParent.body.map((link: any) => link.studentId)).toEqual([IDS.student2]);

      const asStudent = await request(server)
        .get(`/relations/finance-owner-student/by-student/${IDS.student1}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(asStudent.body).toEqual([]);

      const contacts = await request(server)
        .get('/relations/my-contacts')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(contacts.body.map((person: any) => person.userId)).not.toContain(IDS.student1);
    });

    it('ne touche pas aux AUTRES liens du même parent', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student2}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
    });

    it('est idempotente : deuxième appel 200, même date de rupture', async () => {
      const res = await request(server)
        .delete(unlinkPath(IDS.parent1, IDS.student1))
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.endedAt).toBe(endedAtFirstCall);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // La rupture, par l'élève — l'autre côté du même bouton
  // ──────────────────────────────────────────────────────────────────────────
  describe("rupture par l'élève", () => {
    it("l'élève délie son parent financeur", async () => {
      const res = await request(server)
        .delete(unlinkPath(IDS.parent1, IDS.student2))
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.endedBy).toBe(IDS.student2);
    });

    it('le parent ne voit plus aucun élève', async () => {
      const res = await request(server)
        .get(`/relations/finance-owner-student/${IDS.parent1}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.body).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Réversibilité — le parcours de rattachement reste utilisable
  // ──────────────────────────────────────────────────────────────────────────
  describe('un nouveau rattachement reste possible après rupture', () => {
    it('le parent redemande le rattachement, l\'élève approuve, le lien renaît', async () => {
      const created = await request(server)
        .post('/parent-link-requests')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ studentLoginIdentifier: 'theo.eleve' });
      expect(created.status).toBe(201);

      const approved = await request(server)
        .post(`/parent-link-requests/${created.body.id}/approve`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(approved.status).toBe(201);

      const links = await request(server)
        .get(`/relations/finance-owner-student/${IDS.parent1}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(links.body.map((link: any) => link.studentId)).toEqual([IDS.student1]);
    });

    it('les droits sont rouverts — statistiques de nouveau lisibles', async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
    });

    it('la période passée reste prouvable : deux lignes, une rompue, une active', async () => {
      const rows = await financeLinkRepo.find({
        where: { financeOwnerId: IDS.parent1, studentId: IDS.student1 },
        order: { createdAt: 'ASC' },
      });
      expect(rows).toHaveLength(2);
      expect(rows.filter((row) => row.endedAt !== null)).toHaveLength(1);
      expect(rows.filter((row) => row.endedAt === null)).toHaveLength(1);
    });

    it('un lien actif ne peut pas être créé deux fois — le 409 subsiste', async () => {
      const res = await request(server)
        .post('/relations/finance-owner-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ financeOwnerId: IDS.parent1, studentId: IDS.student1 });
      expect(res.status).toBe(409);
    });
  });
});

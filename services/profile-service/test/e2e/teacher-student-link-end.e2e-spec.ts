/**
 * E2E — Mettre fin à une relation élève ↔ formateur (arbitrage du 2026-08-12)
 *
 * Route testée :
 *   DELETE /relations/teacher-student/:teacherId/:studentId
 *
 * Ce que cette suite doit prouver, au-delà du code retour :
 *   1. SEUL LE RP décide — différence assumée avec le déliement parent
 *      financeur, où les deux parties peuvent rompre. Le formateur, l'élève, le
 *      parent financeur, l'AF et même le TI sont refusés ;
 *   2. la fin REFERME les droits ouverts par la relation — profil,
 *      statistiques, et `/internal/relations` consommé par
 *      archive-document-service ;
 *   3. elle n'efface rien : la ligne reste en base avec `endedAt`/`endedBy` et
 *      le motif consigné par le RP ;
 *   4. elle est idempotente et ne réécrit ni la date ni le motif initiaux ;
 *   5. la relation reste RECRÉABLE ensuite — un arrêt n'est pas un bannissement ;
 *   6. aucune fin automatique : rien d'autre que cette route ne termine la
 *      relation.
 *
 * Le graphe de test :
 *   teacher1 enseigne à student1 ET à student2
 *   parent1 finance student1 — c'est la partie liée qui n'a PAS le droit
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
import { TeacherStudentLink } from '../../src/relations/entities/teacher-student-link.entity';

describe("[E2E] Mettre fin à une relation élève ↔ formateur", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let teacherLinkRepo: Repository<TeacherStudentLink>;

  let teacherToken: string;
  let student1Token: string;
  let parentToken: string;
  let rpToken: string;
  let apToken: string;
  let afToken: string;
  let tiToken: string;

  const internalHeaders = { 'x-internal-secret': INTERNAL_SECRET };

  /** Chemin de la fin, écrit une seule fois. */
  const endPath = (teacherId: string, studentId: string) =>
    `/relations/teacher-student/${teacherId}/${studentId}`;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    teacherLinkRepo = app.get<Repository<TeacherStudentLink>>(
      getRepositoryToken(TeacherStudentLink),
    );

    teacherToken  = makeJwt(IDS.teacher1, 'formateur');
    student1Token = makeJwt(IDS.student1, 'eleve');
    parentToken   = makeJwt(IDS.parent1,  'parent_financeur');
    rpToken       = makeJwt(IDS.rp1,      'responsable_pedagogique');
    apToken       = makeJwt(IDS.ap1,      'animateur_pedagogique');
    afToken       = makeJwt(IDS.adminFin, 'administrateur_financier');
    tiToken       = makeJwt(IDS.ti,       'technicien_informatique');

    identityAccessStub.registerAccount(IDS.student1, 'theo.eleve', 'eleve');
    identityAccessStub.registerAccount(IDS.student2, 'nina.eleve', 'eleve');
    identityAccessStub.registerAccount(IDS.teacher1, 'farid.prof', 'formateur');
    identityAccessStub.registerAccount(IDS.parent1, 'paul.parent', 'parent_financeur');

    await request(server)
      .post('/internal/create-student-profiles')
      .set(internalHeaders)
      .send({ userId: IDS.student1, firstName: 'Théo', lastName: 'Suivi', level: '3e' });
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

    // Le parent finance student1 : c'est la partie liée qui n'a PAS le droit de
    // mettre fin à une affectation pédagogique.
    await request(server)
      .post('/internal/link-parent')
      .set(internalHeaders)
      .send({ studentId: IDS.student1, financeOwnerId: IDS.parent1 })
      .expect(201);

    // Les deux relations élève ↔ formateur, créées par le RP.
    for (const studentId of [IDS.student1, IDS.student2]) {
      await request(server)
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ teacherId: IDS.teacher1, studentId })
        .expect(201);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // État initial : la relation ouvre bien les droits qu'on va voir se refermer
  // ──────────────────────────────────────────────────────────────────────────
  describe('avant la fin — la relation ouvre les droits', () => {
    it("le formateur lit le profil de son élève", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
    });

    it("le formateur lit les statistiques de son élève", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
    });

    it('archive-document-service voit la relation par la route interne', async () => {
      const res = await request(server)
        .get(`/internal/relations/${IDS.teacher1}/${IDS.student1}?viewerRole=formateur`)
        .set(internalHeaders);
      expect(res.status).toBe(200);
      expect(res.body.relations).toEqual([
        { kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: false },
      ]);
    });

    it("la fiche de l'élève liste le formateur AVEC SON NOM, jamais un UUID seul", async () => {
      const res = await request(server)
        .get(`/relations/teacher-student/${IDS.student1}`)
        .set('Authorization', `Bearer ${rpToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].teacherName).toEqual({ firstName: 'Farid', lastName: 'Formateur' });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Qui décide — le cœur de l'arbitrage
  // ──────────────────────────────────────────────────────────────────────────
  describe('seul le RP peut mettre fin à la relation', () => {
    /**
     * Le TI figure dans ce tableau : il PEUT rompre un lien parent financeur,
     * il ne peut PAS défaire une affectation pédagogique. C'est la différence
     * que ce test verrouille.
     */
    it.each([
      ['le formateur concerné', () => teacherToken],
      ["l'élève concerné", () => student1Token],
      ['le parent financeur de l\'élève', () => parentToken],
      ['un AP', () => apToken],
      ['un administrateur financier', () => afToken],
      ['un TI', () => tiToken],
    ])('%s reçoit 403', async (_label, token) => {
      const res = await request(server)
        .delete(endPath(IDS.teacher1, IDS.student1))
        .set('Authorization', `Bearer ${token()}`);
      expect(res.status).toBe(403);
    });

    it("un refus ne termine rien : la relation est toujours active", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
    });

    it("une relation inexistante renvoie 404, avec un message en français", async () => {
      const res = await request(server)
        .delete(endPath(IDS.teacher2, IDS.student1))
        .set('Authorization', `Bearer ${rpToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Aucune relation');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // La fin, par le RP — et ce qu'elle referme
  // ──────────────────────────────────────────────────────────────────────────
  describe('fin prononcée par le RP', () => {
    let endedAtFirstCall: string;

    it('termine la relation et renvoie la ligne, motif compris', async () => {
      const res = await request(server)
        .delete(endPath(IDS.teacher1, IDS.student1))
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ reason: "L'élève a demandé un nouveau professeur." });

      expect(res.status).toBe(200);
      expect(res.body.endedAt).not.toBeNull();
      expect(res.body.endedBy).toBe(IDS.rp1);
      expect(res.body.endReason).toBe("L'élève a demandé un nouveau professeur.");
      endedAtFirstCall = res.body.endedAt;
    });

    it("le formateur ne lit PLUS le profil de son ex-élève", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
    });

    it("le formateur ne lit PLUS les statistiques de son ex-élève", async () => {
      const res = await request(server)
        .get(`/profiles/${IDS.student1}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`);
      // 404 et non 403 : on ne révèle pas l'existence de ce qu'on ne peut voir.
      expect(res.status).toBe(404);
    });

    it('archive-document-service ne voit PLUS la relation — les archives se referment', async () => {
      const res = await request(server)
        .get(`/internal/relations/${IDS.teacher1}/${IDS.student1}?viewerRole=formateur`)
        .set(internalHeaders);
      expect(res.status).toBe(200);
      expect(res.body.relations).toEqual([]);
    });

    it("la fiche de l'élève ne liste plus ce formateur", async () => {
      const res = await request(server)
        .get(`/relations/teacher-student/${IDS.student1}`)
        .set('Authorization', `Bearer ${rpToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("AUCUNE LIGNE N'EST SUPPRIMÉE : la trace reste en base", async () => {
      const rows = await teacherLinkRepo.find({
        where: { teacherId: IDS.teacher1, studentId: IDS.student1 },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].endedAt).not.toBeNull();
      expect(rows[0].endedBy).toBe(IDS.rp1);
      expect(rows[0].endReason).toBe("L'élève a demandé un nouveau professeur.");
    });

    it('rejouer la fin renvoie 200 sans réécrire la date ni le motif initiaux', async () => {
      const res = await request(server)
        .delete(endPath(IDS.teacher1, IDS.student1))
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ reason: 'Motif différent, saisi au second appel' });

      expect(res.status).toBe(200);
      expect(res.body.endedAt).toBe(endedAtFirstCall);
      expect(res.body.endReason).toBe("L'élève a demandé un nouveau professeur.");
    });

    it("aucune fin automatique : l'autre élève du formateur reste lié", async () => {
      const res = await request(server)
        .get(`/internal/relations/${IDS.teacher1}/${IDS.student2}?viewerRole=formateur`)
        .set(internalHeaders);
      expect(res.body.relations).toEqual([
        { kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: false },
      ]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Réversibilité — un arrêt n'est pas un bannissement
  // ──────────────────────────────────────────────────────────────────────────
  describe('la relation reste recréable', () => {
    it('le RP peut relier les deux mêmes personnes', async () => {
      const res = await request(server)
        .post('/relations/teacher-student')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ teacherId: IDS.teacher1, studentId: IDS.student1 });
      expect(res.status).toBe(201);
      expect(res.body.endedAt).toBeNull();
    });

    it('les droits sont rouverts', async () => {
      const profile = await request(server)
        .get(`/profiles/${IDS.student1}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(profile.status).toBe(200);

      const relations = await request(server)
        .get(`/internal/relations/${IDS.teacher1}/${IDS.student1}?viewerRole=formateur`)
        .set(internalHeaders);
      expect(relations.body.relations).toEqual([
        { kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: false },
      ]);
    });

    it("la période passée est CONSERVÉE à côté de la nouvelle : deux lignes", async () => {
      const rows = await teacherLinkRepo.find({
        where: { teacherId: IDS.teacher1, studentId: IDS.student1 },
        order: { createdAt: 'ASC' },
      });
      expect(rows).toHaveLength(2);
      expect(rows[0].endedAt).not.toBeNull();
      expect(rows[1].endedAt).toBeNull();
    });
  });
});

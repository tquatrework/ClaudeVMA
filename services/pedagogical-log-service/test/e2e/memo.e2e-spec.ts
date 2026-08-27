/**
 * E2E — Mémo élève (chantier feat/memo-formules, assainissement backend)
 *
 * Routes testées (voir docs/routes.md > pedagogical-log-service > « Mémo élève ») :
 *
 *   GET    /memos                                        titulaire élève
 *   GET    /memos/search?q=                               titulaire élève
 *   GET    /memos/students/:studentId                     tiers relié (B6)
 *   POST   /memos/chapters                                titulaire élève
 *   GET    /memos/chapters/:chapterId                     titulaire + tiers relié
 *   PUT    /memos/chapters/:chapterId                     titulaire élève
 *   DELETE /memos/chapters/:chapterId                      titulaire élève
 *   POST   /memos/chapters/:chapterId/items                titulaire élève (texte/formule)
 *   POST   /memos/chapters/:chapterId/items/image           titulaire élève (multipart)
 *   GET    /memos/chapters/:chapterId/items/:itemId/image   titulaire + tiers relié
 *   PUT    /memos/chapters/:chapterId/items/:itemId         titulaire élève
 *   DELETE /memos/chapters/:chapterId/items/:itemId          titulaire élève
 *
 * Cet environnement e2e n'a pas de profile-service réel : PROFILE_SERVICE_URL
 * n'est pas configurée (même constat documenté dans
 * pedagogical-log.e2e-spec.ts). La vérification de relation (assertCanRead,
 * branche "tiers non-self") échoue donc fermée en 503, jamais en 200/403
 * silencieux — comportement attendu, pas une anomalie de ce fichier. Ces cas
 * confirment que la garde de rôle (403) et les gardes "propriétaire" (403
 * synchrone, sans réseau) s'appliquent AVANT tout appel réseau, et que le
 * chemin "self" (titulaire lisant son propre mémo) ne déclenche jamais
 * d'appel réseau (vérifié en unit test, `test/unit/memo/memo.service.spec.ts`).
 */

import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';
import { MemoChapter } from '../../src/memo/entities/memo-chapter.entity';
import {
  MEMO_MAX_CHAPTERS_PER_STUDENT,
  MEMO_MAX_ITEMS_PER_CHAPTER,
  MEMO_IMAGE_MAX_BYTES,
} from '../../src/memo/memo.constants';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function buildPngBuffer(totalSize = 200): Buffer {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(Math.max(0, totalSize - PNG_HEADER.length), 0)]);
}

describe('[E2E] Mémo élève', () => {
  let app: INestApplication;
  let student1Token: string;
  let student2Token: string;
  let teacher1Token: string;
  let parent1Token: string;
  let rp1Token: string;

  beforeAll(async () => {
    app = await createTestApp();

    student1Token = makeJwt(IDS.student1, 'eleve');
    student2Token = makeJwt(IDS.student2, 'eleve');
    teacher1Token = makeJwt(IDS.teacher1, 'formateur');
    parent1Token = makeJwt(IDS.parent1, 'parent_financeur');
    rp1Token = makeJwt(IDS.rp1, 'responsable_pedagogique');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth guard', () => {
    it('GET /memos sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/memos');
      expect(res.status).toBe(401);
    });

    it('POST /memos/chapters sans token → 401', async () => {
      const res = await request(app.getHttpServer()).post('/memos/chapters').send({ title: 'x' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /memos/chapters — création', () => {
    it('[OK] un élève crée un chapitre dans son propre mémo → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Algèbre' });

      expect(res.status).toBe(201);
      expect(res.body.studentId).toBe(IDS.student1);
      expect(res.body.title).toBe('Algèbre');
    });

    it('[CRITIQUE] un formateur ne peut pas créer un chapitre → 403 (garde de rôle, avant tout réseau)', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ title: 'Notes formateur' });

      expect(res.status).toBe(403);
    });

    it('[CRITIQUE] un RP ne peut pas créer un chapitre → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${rp1Token}`)
        .send({ title: 'Notes RP' });

      expect(res.status).toBe(403);
    });

    it('titre manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('[CRITIQUE] plafond de chapitres atteint → 400 explicite', async () => {
      const repository = app.get<Repository<MemoChapter>>(getRepositoryToken(MemoChapter));

      // Seed direct via repository (contourne le réseau HTTP pour aller vite) :
      // amène student2 exactement au plafond.
      const existing = await repository.count({ where: { studentId: IDS.student2 } });
      const toCreate = MEMO_MAX_CHAPTERS_PER_STUDENT - existing;
      const rows = Array.from({ length: toCreate }, (_unused, index) =>
        repository.create({ studentId: IDS.student2, title: `Chapitre ${index}`, order: index }),
      );
      await repository.save(rows);

      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ title: 'En trop' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /memos et /memos/chapters/:chapterId — lecture', () => {
    let chapterId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Géométrie' });
      chapterId = res.body.id;
    });

    it('[OK] le titulaire liste son mémo → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('[CRITIQUE] un formateur ne peut pas appeler GET /memos → 403 (réservé élève)', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos')
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });

    it('[OK] le titulaire lit le détail de son chapitre → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(chapterId);
    });

    it('chapitre introuvable → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/chapters/${IDS.unknown}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
    });

    it("[point B5] un autre élève sur ce chapitre : la relation est revérifiée (self ≠ studentId) → 503, " +
      "profile-service non configuré dans cet environnement e2e — jamais un 200 silencieux", async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(503);
    });

    it('[CRITIQUE] un formateur (même lié en théorie) : relation revérifiée → 503, jamais 200 silencieux', async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(503);
    });

    it('[B6] GET /memos/students/:studentId pour un tiers → 503 (relation revérifiée, jamais en cache)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/students/${IDS.student1}`)
        .set('Authorization', `Bearer ${parent1Token}`);

      expect(res.status).toBe(503);
    });

    it('[B6] GET /memos/students/:studentId pour le titulaire lui-même → 200, sans appel réseau', async () => {
      const res = await request(app.getHttpServer())
        .get(`/memos/students/${IDS.student1}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT/DELETE /memos/chapters/:chapterId — écriture réservée au propriétaire', () => {
    let chapterId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'À renommer' });
      chapterId = res.body.id;
    });

    it('[OK] le propriétaire renomme son chapitre → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Renommé' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Renommé');
    });

    it('[CRITIQUE] un formateur ne peut pas renommer → 403', async () => {
      const res = await request(app.getHttpServer())
        .put(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ title: 'Hack' });

      expect(res.status).toBe(403);
    });

    it('[OK] le propriétaire supprime son chapitre → 204', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(204);

      const getRes = await request(app.getHttpServer())
        .get(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(getRes.status).toBe(404);
    });

    it('[CRITIQUE] un RP ne peut pas supprimer → 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/memos/chapters/${chapterId}`)
        .set('Authorization', `Bearer ${rp1Token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Items texte/formule — POST/PUT/DELETE /memos/chapters/:chapterId/items(/:itemId)', () => {
    let chapterId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Chapitre items' });
      chapterId = res.body.id;
    });

    it('[OK] le propriétaire ajoute un item formule → 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ type: 'formula', content: '$x^2+y^2=z^2$' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('formula');
    });

    it('[CRITIQUE] un formateur ne peut pas ajouter un item → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .send({ type: 'text', content: 'x' });

      expect(res.status).toBe(403);
    });

    it("type 'image' refusé sur cette route JSON → 400 (utiliser la route multipart dédiée)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ type: 'image', content: 'x' });

      expect(res.status).toBe(400);
    });

    it('chapitre introuvable → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${IDS.unknown}/items`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ type: 'text', content: 'x' });

      expect(res.status).toBe(404);
    });

    it('[CRITIQUE] plafond d\'items atteint → 400 explicite', async () => {
      const budgetRes = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Chapitre plein' });
      const fullChapterId = budgetRes.body.id;

      for (let index = 0; index < MEMO_MAX_ITEMS_PER_CHAPTER; index += 1) {
        const res = await request(app.getHttpServer())
          .post(`/memos/chapters/${fullChapterId}/items`)
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ type: 'text', content: `item ${index}` });
        expect(res.status).toBe(201);
      }

      const overflow = await request(app.getHttpServer())
        .post(`/memos/chapters/${fullChapterId}/items`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ type: 'text', content: 'en trop' });

      expect(overflow.status).toBe(400);
    }, 30000);

    describe('modification et suppression', () => {
      let itemId: string;

      beforeEach(async () => {
        const res = await request(app.getHttpServer())
          .post(`/memos/chapters/${chapterId}/items`)
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ type: 'text', content: 'à modifier' });
        itemId = res.body.id;
      });

      it('[OK] le propriétaire modifie son item → 200', async () => {
        const res = await request(app.getHttpServer())
          .put(`/memos/chapters/${chapterId}/items/${itemId}`)
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ content: 'modifié' });

        expect(res.status).toBe(200);
        expect(res.body.content).toBe('modifié');
      });

      it('[CRITIQUE] un tiers ne peut pas modifier → 403', async () => {
        const res = await request(app.getHttpServer())
          .put(`/memos/chapters/${chapterId}/items/${itemId}`)
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ content: 'hack' });

        expect(res.status).toBe(403);
      });

      it('[OK] le propriétaire supprime son item → 204', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/memos/chapters/${chapterId}/items/${itemId}`)
          .set('Authorization', `Bearer ${student1Token}`);

        expect(res.status).toBe(204);
      });

      it('[CRITIQUE] un tiers ne peut pas supprimer → 403', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/memos/chapters/${chapterId}/items/${itemId}`)
          .set('Authorization', `Bearer ${teacher1Token}`);

        expect(res.status).toBe(403);
      });
    });
  });

  describe('Items image — POST /memos/chapters/:chapterId/items/image et téléchargement', () => {
    let chapterId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Chapitre images' });
      chapterId = res.body.id;
    });

    it('[OK] le propriétaire ajoute une image PNG valide → 201, puis la télécharge → 200', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items/image`)
        .set('Authorization', `Bearer ${student1Token}`)
        .field('caption', 'Formule au tableau')
        .attach('file', buildPngBuffer(300), 'formule.png');

      expect(createRes.status).toBe(201);
      expect(createRes.body.type).toBe('image');
      expect(createRes.body.content).toBe('Formule au tableau');

      const downloadRes = await request(app.getHttpServer())
        .get(`/memos/chapters/${chapterId}/items/${createRes.body.id}/image`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toContain('image/png');
    });

    it('[CRITIQUE] un formateur ne peut pas ajouter une image → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items/image`)
        .set('Authorization', `Bearer ${teacher1Token}`)
        .attach('file', buildPngBuffer(), 'formule.png');

      expect(res.status).toBe(403);
    });

    it('aucun fichier envoyé → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items/image`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(400);
    });

    it('[CRITIQUE] image dépassant le plafond de taille → 413 structuré', async () => {
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items/image`)
        .set('Authorization', `Bearer ${student1Token}`)
        .attach('file', buildPngBuffer(MEMO_IMAGE_MAX_BYTES + 1000), 'grosse-image.png');

      expect(res.status).toBe(413);
      expect(res.body.code).toBe('UPLOAD_FILE_TOO_LARGE');
      expect(res.body.maxUploadBytes).toBe(MEMO_IMAGE_MAX_BYTES);
    });

    it('[CRITIQUE] un SVG est explicitement refusé → 400', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items/image`)
        .set('Authorization', `Bearer ${student1Token}`)
        .attach('file', svg, 'evil.svg');

      expect(res.status).toBe(400);
    });

    it('format hors liste blanche image (PDF) → 400', async () => {
      const pdf = Buffer.from('%PDF-1.4 fake pdf content');
      const res = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items/image`)
        .set('Authorization', `Bearer ${student1Token}`)
        .attach('file', pdf, 'devoir.pdf');

      expect(res.status).toBe(400);
    });

    it('[CRITIQUE] un tiers ne peut pas télécharger une image sans relation → 503 (jamais 200 silencieux)', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items/image`)
        .set('Authorization', `Bearer ${student1Token}`)
        .attach('file', buildPngBuffer(), 'formule2.png');

      const res = await request(app.getHttpServer())
        .get(`/memos/chapters/${chapterId}/items/${createRes.body.id}/image`)
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(503);
    });
  });

  describe('GET /memos/search — recherche', () => {
    let chapterId: string;

    beforeAll(async () => {
      const chapterRes = await request(app.getHttpServer())
        .post('/memos/chapters')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Chapitre recherche' });
      chapterId = chapterRes.body.id;

      await request(app.getHttpServer())
        .post(`/memos/chapters/${chapterId}/items`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ type: 'text', content: 'produit scalaire remarquable' });
    });

    it('[OK] le titulaire trouve un item par mot-clé → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos/search')
        .query({ q: 'scalaire' })
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('q manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos/search')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(400);
    });

    it('[CRITIQUE] un formateur ne peut pas appeler GET /memos/search → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/memos/search')
        .query({ q: 'scalaire' })
        .set('Authorization', `Bearer ${teacher1Token}`);

      expect(res.status).toBe(403);
    });
  });
});

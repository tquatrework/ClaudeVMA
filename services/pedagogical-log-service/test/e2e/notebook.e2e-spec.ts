/**
 * E2E — Carnet personnel (Notebook), généralisé à tout rôle le 2026-08-27
 * (docs/architecture.md, "Generalisation du carnet personnel a d'autres
 * roles que l'eleve").
 *
 * Ce n'est PAS une extension du carnet élève à d'autres rôles : c'est le
 * MÊME mécanisme répliqué par titulaire. Tout utilisateur authentifié —
 * élève, formateur, animateur pédagogique, et tout rôle futur — a son
 * propre carnet, strictement privé. Aucune relation métier ni aucun rôle
 * administratif (RP, AF, TI) n'y ouvre de droit — l'ancien accès spécial
 * TI "incident" est retiré par ce même chantier.
 *
 * Changement observable côté contrat HTTP par rapport à l'ancienne route :
 *   AVANT : /students/:studentId/notebook   (réservé au rôle éleve, +TI)
 *   APRÈS : /pedagogical-logs/notebook       (tout rôle, titulaire uniquement,
 *           aucun paramètre de chemin désignant un titulaire)
 * Le champ retourné `studentId` devient `ownerId`.
 *
 * Spécification fonctionnelle réelle — notes rapides immuables (docs/
 * architecture.md, arbitrage du 2026-08-27) : une entrée est une pensée
 * instantanée horodatée automatiquement (`createdAt`), jamais éditée après
 * coup. Conséquence sur ce contrat HTTP, testée ci-dessous :
 *   - `PATCH /pedagogical-logs/notebook/:id` est RETIRÉE (404, plus de route).
 *   - `GET /pedagogical-logs/notebook` accepte des paramètres de requête
 *     optionnels et combinables `from`/`to` (plage sur `createdAt`) et `q`
 *     (recherche texte libre sur `content`).
 *
 * Routes testées :
 *   POST   /pedagogical-logs/notebook          créer une entrée dans MON carnet
 *   GET    /pedagogical-logs/notebook          lire (ou rechercher) MES entrées
 *   GET    /pedagogical-logs/notebook/:id      détail d'une de mes entrées
 *   DELETE /pedagogical-logs/notebook/:id      supprimer une de mes entrées
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, IDS } from './helpers/app.helper';

describe('[E2E] Carnet personnel (Notebook)', () => {
  let app: INestApplication;

  let studentToken: string;
  let otherStudentToken: string;
  let teacherToken: string;
  let apToken: string;
  let rpToken: string;
  let tiToken: string;
  let adminFinancierToken: string;
  let parentToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    studentToken       = makeJwt(IDS.student1,      'eleve');
    otherStudentToken  = makeJwt(IDS.student2,      'eleve');
    teacherToken       = makeJwt(IDS.teacher1,      'formateur');
    apToken            = makeJwt(IDS.ap1,           'animateur_pedagogique');
    rpToken            = makeJwt(IDS.rp1,           'responsable_pedagogique');
    tiToken            = makeJwt(IDS.ti,            'technicien_informatique');
    adminFinancierToken = makeJwt(IDS.adminFinancier, 'administrateur_financier');
    parentToken        = makeJwt(IDS.parent1,       'parent_financeur');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth guard', () => {
    it('POST /pedagogical-logs/notebook sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .send({ content: 'Test' });
      expect(res.status).toBe(401);
    });

    it('GET /pedagogical-logs/notebook sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/pedagogical-logs/notebook');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /pedagogical-logs/notebook — création, cas nominal par rôle', () => {
    it.each([
      ['élève', () => studentToken, IDS.student1],
      ['formateur', () => teacherToken, IDS.teacher1],
      ['animateur pédagogique', () => apToken, IDS.ap1],
      ['responsable pédagogique', () => rpToken, IDS.rp1],
      ['technicien informatique', () => tiToken, IDS.ti],
      ['administrateur financier', () => adminFinancierToken, IDS.adminFinancier],
      ['parent financeur', () => parentToken, IDS.parent1],
    ])('[OK] un utilisateur (%s) crée une entrée dans son propre carnet → 201', async (_label, getToken, ownerId) => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${getToken()}`)
        .send({ content: 'Mon entrée personnelle', title: 'Titre' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.ownerId).toBe(ownerId);
    });

    it('content manquant → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Sans contenu' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /pedagogical-logs/notebook — lecture, isolation stricte par titulaire', () => {
    let studentEntryId: string;
    let teacherEntryId: string;

    beforeAll(async () => {
      const studentEntry = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Journal élève', title: 'Jour 1' });
      studentEntryId = studentEntry.body.id;

      const teacherEntry = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ content: 'Notes personnelles formateur', title: 'Notes' });
      teacherEntryId = teacherEntry.body.id;
    });

    it('[OK] chaque titulaire lit son propre carnet → 200, isolé de celui des autres', async () => {
      const studentRes = await request(app.getHttpServer())
        .get('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(studentRes.status).toBe(200);
      expect(Array.isArray(studentRes.body)).toBe(true);
      expect(studentRes.body.some((e: any) => e.id === studentEntryId)).toBe(true);
      expect(studentRes.body.some((e: any) => e.id === teacherEntryId)).toBe(false);

      const teacherRes = await request(app.getHttpServer())
        .get('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(teacherRes.status).toBe(200);
      expect(teacherRes.body.some((e: any) => e.id === teacherEntryId)).toBe(true);
      expect(teacherRes.body.some((e: any) => e.id === studentEntryId)).toBe(false);
    });

    it('[OK] le titulaire lit le détail de sa propre entrée → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/notebook/${studentEntryId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(studentEntryId);
    });

    it.each([
      ['un parent financeur', () => parentToken],
      ['un autre élève', () => otherStudentToken],
      ['un formateur non titulaire', () => teacherToken],
      ['le RP — aucune exception administrative', () => rpToken],
      ['le TI — ancien accès incident retiré', () => tiToken],
      ["l'administrateur financier — aucune exception administrative", () => adminFinancierToken],
    ])('[CRITIQUE] %s tente de lire le détail du carnet d\'autrui → 403', async (_label, getToken) => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/notebook/${studentEntryId}`)
        .set('Authorization', `Bearer ${getToken()}`);

      expect(res.status).toBe(403);
    });

    it('GET entrée inexistante → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/notebook/${IDS.unknown}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /pedagogical-logs/notebook/:id — RETIRÉE (notes rapides immuables)', () => {
    it('[OK] une pensée instantanée ne s\'édite pas → PATCH n\'est plus une route (404)', async () => {
      const created = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ content: 'Pensée immuable' });

      const res = await request(app.getHttpServer())
        .patch(`/pedagogical-logs/notebook/${created.body.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ content: 'Tentative de modification' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /pedagogical-logs/notebook — recherche (from/to, q)', () => {
    let firstEntryId: string;
    let secondEntryId: string;

    beforeAll(async () => {
      const first = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ content: 'Penser à réviser les dérivées' });
      firstEntryId = first.body.id;

      const second = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ content: 'Ne pas oublier le rendez-vous formateur' });
      secondEntryId = second.body.id;
    });

    it('[OK] q filtre par recherche texte libre, insensible à la casse, sur content', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs/notebook')
        .query({ q: 'DÉRIVÉES' })
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((e: any) => e.id === firstEntryId)).toBe(true);
      expect(res.body.some((e: any) => e.id === secondEntryId)).toBe(false);
    });

    it('[OK] from/to filtrent sur createdAt (plage englobant aujourd\'hui)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs/notebook')
        .query({ from: today, to: today })
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((e: any) => e.id === firstEntryId)).toBe(true);
      expect(res.body.some((e: any) => e.id === secondEntryId)).toBe(true);
    });

    it('[OK] from/to hors plage → aucune entrée retournée', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs/notebook')
        .query({ from: '2000-01-01', to: '2000-01-02' })
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((e: any) => e.id === firstEntryId)).toBe(false);
      expect(res.body.some((e: any) => e.id === secondEntryId)).toBe(false);
    });

    it('[OK] sans filtre, GET continue de tout renvoyer (comportement inchangé)', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((e: any) => e.id === firstEntryId)).toBe(true);
      expect(res.body.some((e: any) => e.id === secondEntryId)).toBe(true);
    });

    it('[CRITIQUE] la recherche reste isolée par titulaire — q ne remonte pas le carnet d\'autrui', async () => {
      const res = await request(app.getHttpServer())
        .get('/pedagogical-logs/notebook')
        .query({ q: 'dérivées' })
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((e: any) => e.id === firstEntryId)).toBe(false);
    });
  });

  describe('DELETE /pedagogical-logs/notebook/:id — suppression, titulaire uniquement', () => {
    it('[OK] le titulaire supprime sa propre entrée → 204', async () => {
      const created = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${apToken}`)
        .send({ content: 'À supprimer' });
      const entryId = created.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/pedagogical-logs/notebook/${entryId}`)
        .set('Authorization', `Bearer ${apToken}`);

      expect(res.status).toBe(204);
    });

    it.each([
      ['un autre utilisateur', () => studentToken],
      ['le TI — ancien accès incident retiré', () => tiToken],
    ])('[CRITIQUE] %s ne peut pas supprimer le carnet d\'autrui → 403', async (_label, getToken) => {
      const created = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${apToken}`)
        .send({ content: 'Ne doit pas être supprimée par un tiers' });
      const entryId = created.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/pedagogical-logs/notebook/${entryId}`)
        .set('Authorization', `Bearer ${getToken()}`);

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /pedagogical-logs/notebook/owners/:ownerId — accès administratif et
  // parental, arbitrage du 2026-08-28 (docs/architecture.md, "Acces
  // administratif et parental au carnet personnel — parametrable par le TI,
  // defaut ferme"). Toujours en LECTURE SEULE, désactivé par défaut : ces
  // tests s'appuient sur `PATCH /pedagogical-logs/settings/notebook-access`
  // (testée en détail dans pedagogical-log.e2e-spec.ts) pour faire varier le
  // réglage. Réinitialisé au défaut fermé en fin de bloc pour ne pas affecter
  // d'éventuels tests suivants dans ce même fichier.
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /pedagogical-logs/notebook/owners/:ownerId — accès administratif et parental', () => {
    let teacherOwnerEntryId: string;

    async function patchNotebookAccessSettings(body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .patch('/pedagogical-logs/settings/notebook-access')
        .set('Authorization', `Bearer ${tiToken}`)
        .send(body);
    }

    beforeAll(async () => {
      const created = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ content: 'Pensée du formateur, visée par les tests de tiers' });
      teacherOwnerEntryId = created.body.id;
    });

    afterAll(async () => {
      await patchNotebookAccessSettings({ adminAccess: 'none', parentAccessToOwnChild: false });
    });

    it('sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get(
        `/pedagogical-logs/notebook/owners/${IDS.teacher1}`,
      );
      expect(res.status).toBe(401);
    });

    it('[OK] le titulaire (RP) lit son propre carnet via cette route, même quand le réglage est fermé (défaut)', async () => {
      const own = await request(app.getHttpServer())
        .post('/pedagogical-logs/notebook')
        .set('Authorization', `Bearer ${rpToken}`)
        .send({ content: 'Pensée du RP, lue par lui-même via la route tiers' });

      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/notebook/owners/${IDS.rp1}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((e: any) => e.id === own.body.id)).toBe(true);
    });

    describe('rôles structurellement jamais éligibles → 403, même réglage grand ouvert', () => {
      beforeAll(async () => {
        const res = await patchNotebookAccessSettings({ adminAccess: 'all_admins', parentAccessToOwnChild: true });
        expect(res.status).toBe(200);
      });

      it.each([
        ['élève', () => studentToken],
        ['formateur (même un autre formateur)', () => teacherToken],
        ['animateur pédagogique', () => apToken],
      ])('[CRITIQUE] %s → 403', async (_label, getToken) => {
        const res = await request(app.getHttpServer())
          .get(`/pedagogical-logs/notebook/owners/${IDS.teacher1}`)
          .set('Authorization', `Bearer ${getToken()}`);

        expect(res.status).toBe(403);
      });
    });

    describe('axe administratif', () => {
      it('[CRITIQUE] RP → 404 par défaut (adminAccess = "none")', async () => {
        const reset = await patchNotebookAccessSettings({ adminAccess: 'none' });
        expect(reset.status).toBe(200);

        const res = await request(app.getHttpServer())
          .get(`/pedagogical-logs/notebook/owners/${IDS.teacher1}`)
          .set('Authorization', `Bearer ${rpToken}`);

        expect(res.status).toBe(404);
      });

      it('[OK] RP lit le carnet d\'un tiers formateur quand adminAccess = "rp"', async () => {
        const patch = await patchNotebookAccessSettings({ adminAccess: 'rp' });
        expect(patch.status).toBe(200);

        const res = await request(app.getHttpServer())
          .get(`/pedagogical-logs/notebook/owners/${IDS.teacher1}`)
          .set('Authorization', `Bearer ${rpToken}`);

        expect(res.status).toBe(200);
        expect(res.body.some((e: any) => e.id === teacherOwnerEntryId)).toBe(true);
      });

      it.each([
        ["l'administrateur financier (AF)", () => adminFinancierToken],
        ['le technicien informatique (TI)', () => tiToken],
      ])('[CRITIQUE] %s → 404 quand adminAccess = "rp" (AF/TI pas couverts par "rp" seul)', async (_label, getToken) => {
        const res = await request(app.getHttpServer())
          .get(`/pedagogical-logs/notebook/owners/${IDS.teacher1}`)
          .set('Authorization', `Bearer ${getToken()}`);

        expect(res.status).toBe(404);
      });

      it.each([
        ["l'administrateur financier (AF)", () => adminFinancierToken],
        ['le technicien informatique (TI)', () => tiToken],
      ])('[OK] %s lit un carnet tiers quand adminAccess = "all_admins"', async (_label, getToken) => {
        const patch = await patchNotebookAccessSettings({ adminAccess: 'all_admins' });
        expect(patch.status).toBe(200);

        const res = await request(app.getHttpServer())
          .get(`/pedagogical-logs/notebook/owners/${IDS.teacher1}`)
          .set('Authorization', `Bearer ${getToken()}`);

        expect(res.status).toBe(200);
        expect(res.body.some((e: any) => e.id === teacherOwnerEntryId)).toBe(true);
      });
    });

    describe('axe parental', () => {
      it('[CRITIQUE] parent financeur → 404 par défaut (parentAccessToOwnChild = false)', async () => {
        const reset = await patchNotebookAccessSettings({ adminAccess: 'none', parentAccessToOwnChild: false });
        expect(reset.status).toBe(200);

        const res = await request(app.getHttpServer())
          .get(`/pedagogical-logs/notebook/owners/${IDS.student1}`)
          .set('Authorization', `Bearer ${parentToken}`);

        expect(res.status).toBe(404);
      });

      it('[CRITIQUE] parent financeur, réglage activé mais profile-service injoignable dans cet environnement e2e → 503 (échec fermé, jamais un accès silencieux)', async () => {
        const patch = await patchNotebookAccessSettings({ parentAccessToOwnChild: true });
        expect(patch.status).toBe(200);

        const res = await request(app.getHttpServer())
          .get(`/pedagogical-logs/notebook/owners/${IDS.student1}`)
          .set('Authorization', `Bearer ${parentToken}`);

        expect(res.status).toBe(503);
      });
    });

    it('paramètres de recherche (q) transmis, comme sur GET /pedagogical-logs/notebook', async () => {
      await patchNotebookAccessSettings({ adminAccess: 'rp', parentAccessToOwnChild: false });

      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/notebook/owners/${IDS.teacher1}`)
        .query({ q: 'ne correspond à rien de saisi' })
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((e: any) => e.id === teacherOwnerEntryId)).toBe(false);
    });

    it('entrée introuvable/carnet vide pour un titulaire sans entrée → 200 []', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pedagogical-logs/notebook/owners/${IDS.unknown}`)
        .set('Authorization', `Bearer ${rpToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});

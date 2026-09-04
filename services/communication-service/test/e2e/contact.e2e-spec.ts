/**
 * E2E — Contact routes (docs/architecture/contacts-messagerie.md, 2026-09-04)
 *
 * Routes testées :
 *   GET  /contacts                              lister mes contacts actifs
 *   POST /contacts/:id/break                    rompre un contact actif
 *   GET  /contacts/search/by-login-identifier    recherche exacte par identifiant
 *   GET  /contacts/search/by-name                recherche par prénom/nom
 *   GET  /contacts/requests/incoming             demandes reçues en attente
 *   GET  /contacts/requests/outgoing             mes demandes envoyées
 *   POST /contacts/requests                      envoyer une demande
 *   POST /contacts/requests/:id/accept           accepter
 *   POST /contacts/requests/:id/decline          refuser
 *
 * ProfileServiceClient / IdentityAccessClient sont stubbés (overrideProvider) : ce service ne
 * dépend d'aucun autre microservice réellement démarré dans ce harnais e2e.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, makeJwt, getContactRepository, getContactRequestRepository, IDS } from './helpers/app.helper';
import { ProfileServiceClient } from '../../src/contact/clients/profile-service.client';
import { IdentityAccessClient } from '../../src/contact/clients/identity-access.client';

const NAMES: Record<string, { firstName: string; lastName: string }> = {
  [IDS.student1]: { firstName: 'Camille', lastName: 'Durand' },
  [IDS.student2]: { firstName: 'Alex', lastName: 'Martin' },
  [IDS.teacher1]: { firstName: 'Sophie', lastName: 'Bernard' },
  [IDS.teacher2]: { firstName: 'Marc', lastName: 'Petit' },
};

const profileServiceClientStub: Partial<ProfileServiceClient> = {
  getDisplayName: async (userId: string) => (NAMES[userId] ? { userId, ...NAMES[userId] } : null),
  getDisplayNames: async (userIds: string[]) =>
    userIds.filter((id) => NAMES[id]).map((id) => ({ userId: id, ...NAMES[id] })),
  searchByName: async (query: string) =>
    Object.entries(NAMES)
      .filter(([, name]) => `${name.firstName} ${name.lastName}`.toLowerCase().includes(query.toLowerCase()))
      .map(([userId, name]) => ({ userId, ...name, loginIdentifier: `${userId.slice(0, 8)}.login` })),
  getFinanceOwners: async () => [],
  getTeachers: async () => [],
};

// Real contract confirmed against the live identity-access-service stack (2026-09-04,
// docs/routes.md): the success response is `{userId, role}` — no `loginIdentifier` field.
// The stub deliberately omits it so a caller reading `response.loginIdentifier` fails here too.
const identityAccessClientStub: Partial<IdentityAccessClient> = {
  findByLoginIdentifier: async (loginIdentifier: string) => {
    if (loginIdentifier === 'teacher2.login') {
      return { userId: IDS.teacher2, role: 'formateur' };
    }
    return null;
  },
};

describe('[E2E] Contact routes', () => {
  let app: INestApplication;
  let student1Token: string;
  let student2Token: string;
  let teacher1Token: string;
  let teacher2Token: string;

  let activeContactId: string;

  beforeAll(async () => {
    app = await createTestApp([
      { provide: ProfileServiceClient, useValue: profileServiceClientStub },
      { provide: IdentityAccessClient, useValue: identityAccessClientStub },
    ]);

    student1Token = makeJwt(IDS.student1, 'eleve');
    student2Token = makeJwt(IDS.student2, 'eleve');
    teacher1Token = makeJwt(IDS.teacher1, 'formateur');
    teacher2Token = makeJwt(IDS.teacher2, 'formateur');

    // Seed one ACTIVE contact between student1 and teacher1.
    const contactRepository = getContactRepository(app);
    const [userAId, userBId] =
      IDS.student1 < IDS.teacher1 ? [IDS.student1, IDS.teacher1] : [IDS.teacher1, IDS.student1];
    const seeded = await contactRepository.save(
      contactRepository.create({ userAId, userBId, status: 'active', origin: 'default' }),
    );
    activeContactId = seeded.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /contacts', () => {
    it('sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/contacts');
      expect(res.status).toBe(401);
    });

    it('retourne les contacts actifs, avec le nom résolu du correspondant → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      const counterpartIds = res.body.map((c: { counterpartId: string }) => c.counterpartId);
      expect(counterpartIds).toContain(IDS.teacher1);
      const teacherEntry = res.body.find((c: { counterpartId: string }) => c.counterpartId === IDS.teacher1);
      expect(teacherEntry.counterpartName).toMatchObject({ firstName: 'Sophie', lastName: 'Bernard' });
    });

    it("un tiers sans contact reçoit une liste vide → 200", async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('Recherche (point 2, 10, 11)', () => {
    it('by-login-identifier — trouvé → found:true', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts/search/by-login-identifier?value=teacher2.login')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.result.userId).toBe(IDS.teacher2);
      expect(res.body.result.loginIdentifier).toBe('teacher2.login');
    });

    it('by-login-identifier — absent → found:false, pas une erreur (point 10)', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts/search/by-login-identifier?value=inconnu.login')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(false);
    });

    it('by-name — zéro résultat est un cas normal, pas une anomalie (point 10)', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts/search/by-name?q=Zzzzz')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it('by-name — chaque résultat porte un loginIdentifier pour désambiguïser (point 11)', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts/search/by-name?q=Martin')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.results[0].userId).toBe(IDS.student2);
      expect(res.body.results[0].loginIdentifier).toBeTruthy();
    });
  });

  describe('Demandes de contact (points 2-3, 7, 9)', () => {
    let requestId: string;

    it("n'importe qui peut demander n'importe qui (point 2) → 201", async () => {
      const res = await request(app.getHttpServer())
        .post('/contacts/requests')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ targetId: IDS.student2 });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      requestId = res.body.id;
    });

    it('déjà en contact actif → 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/contacts/requests')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ targetId: IDS.teacher1 });

      expect(res.status).toBe(409);
    });

    it('se demander soi-même → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/contacts/requests')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ targetId: IDS.student1 });

      expect(res.status).toBe(400);
    });

    it('apparaît dans les demandes entrantes de la cible', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts/requests/incoming')
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.map((r: { id: string }) => r.id)).toContain(requestId);
    });

    it('aucune acceptation automatique (point 3) — pas encore de contact actif', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${student2Token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('un tiers ne peut pas accepter une demande qui ne lui est pas adressée → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(404);
    });

    it('la cible accepte → 200, un Contact ACTIF est créé', async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');

      const contactsRes = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(contactsRes.body.map((c: { counterpartId: string }) => c.counterpartId)).toContain(IDS.student2);
    });

    it('une demande déjà répondue ne peut pas être répondue deux fois → 409', async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(res.status).toBe(409);
    });
  });

  describe('Refus et pénalité progressive (point 7)', () => {
    it('un refus est journalisé, et le demandeur peut être re-bloqué', async () => {
      // teacher1 demande teacher2 (aucun contact actif entre eux ici).
      let lastRequestId: string | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        // Contourne le cooldown d'un mois entre chaque refus, pour ce test uniquement, en
        // répondant "declined" immédiatement puis en retentant : le cooldown bloquera la
        // 2e tentative en 403, ce que ce test vérifie explicitement plutôt que de l'éviter.
        const createRes = await request(app.getHttpServer())
          .post('/contacts/requests')
          .set('Authorization', `Bearer ${teacher1Token}`)
          .send({ targetId: IDS.teacher2 });

        if (attempt === 0) {
          expect(createRes.status).toBe(201);
          lastRequestId = createRes.body.id;
          const declineRes = await request(app.getHttpServer())
            .post(`/contacts/requests/${lastRequestId}/decline`)
            .set('Authorization', `Bearer ${teacher2Token}`);
          expect(declineRes.status).toBe(200);
        } else {
          // Cooldown d'un mois actif après le 1er refus → 403 tant qu'il n'a pas expiré.
          expect(createRes.status).toBe(403);
          break;
        }
      }
    });

    it('le sens inverse reste libre : la cible qui a refusé peut demander le demandeur (point 7)', async () => {
      const res = await request(app.getHttpServer())
        .post('/contacts/requests')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ targetId: IDS.teacher1 });
      expect(res.status).toBe(201);
    });
  });

  describe('POST /contacts/:id/break', () => {
    it('sans token → 401', async () => {
      const res = await request(app.getHttpServer()).post(`/contacts/${activeContactId}/break`);
      expect(res.status).toBe(401);
    });

    it("un tiers qui n'est pas partie au contact → 404 (masquage, pas 403)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/${activeContactId}/break`)
        .set('Authorization', `Bearer ${student2Token}`);
      expect(res.status).toBe(404);
    });

    it('une des deux parties peut rompre → 200, status devient "broken"', async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/${activeContactId}/break`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('broken');
    });

    it('idempotent : rompre un contact déjà rompu → 200, inchangé', async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/${activeContactId}/break`)
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('broken');
    });

    it('un contact rompu disparaît de la liste des contacts actifs', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${teacher1Token}`);
      expect(res.body.map((c: { id: string }) => c.id)).not.toContain(activeContactId);
    });

    it('un contact rompu peut être redemandé ensuite (point 6)', async () => {
      const res = await request(app.getHttpServer())
        .post('/contacts/requests')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ targetId: IDS.teacher1 });
      expect(res.status).toBe(201);
    });
  });

  describe('Messagerie conditionnée au contact actif (point 8) — via getContactRequestRepository', () => {
    it('un contact en attente ne suffit pas à créer une conversation → 403', async () => {
      // student1 et teacher1 n'ont plus qu'une demande PENDING (voir test précédent), plus de
      // Contact ACTIF (rompu ci-dessus) : une conversation doit être refusée.
      const res = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ participantIds: [IDS.teacher1] });
      expect(res.status).toBe(403);
    });
  });

  it('getContactRequestRepository est bien câblé pour de futurs tests (sanity check)', async () => {
    const repository = getContactRequestRepository(app);
    const count = await repository.count();
    expect(count).toBeGreaterThan(0);
  });
});

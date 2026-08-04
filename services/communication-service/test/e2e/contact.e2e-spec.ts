/**
 * E2E — Contact routes
 *
 * Routes testées :
 *   GET    /contacts                  → lister mes contacts autorisés (COM-BR-010)
 *   POST   /contacts/:id/activate     → activer un precontact
 *   DELETE /contacts/:id              → retirer un contact non obligatoire
 *   PATCH  /contacts/:id/visibility   → changer la préférence d'affichage
 *
 * Ajouté avec la mise en conformité controllers-convention :
 *   - ParseUUIDPipe sur les paramètres d'id (400 si UUID invalide) ;
 *   - @CurrentUser() actor: AuthenticatedUser (plus de req.user: any) ;
 *   - réponses typées via ContactResponseDto.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  makeJwt,
  getContactPolicyRepository,
  IDS,
  TEST_INTERNAL_SECRET,
} from './helpers/app.helper';

describe('[E2E] Contact routes', () => {
  let app: INestApplication;
  let student1Token: string;
  let student2Token: string;

  let activeContactId: string;
  let precontactId: string;
  let mandatoryContactId: string;

  beforeAll(async () => {
    app = await createTestApp();

    student1Token = makeJwt(IDS.student1, 'eleve');
    student2Token = makeJwt(IDS.student2, 'eleve');

    // Seed an authorized contact for student1 via the internal API.
    await request(app.getHttpServer())
      .post('/internal/sync-contacts')
      .set('x-internal-secret', TEST_INTERNAL_SECRET)
      .send({
        userId: IDS.student1,
        contacts: [
          { contactId: IDS.teacher1, relationType: 'teacher-student' },
          { contactId: IDS.teacher2, relationType: 'teacher-student' },
          { contactId: IDS.rp1, relationType: 'rp' },
        ],
      });

    const repository = getContactPolicyRepository(app);
    const contacts = await repository.find({ where: { userId: IDS.student1 } });

    const teacher1Contact = contacts.find((c) => c.contactId === IDS.teacher1);
    activeContactId = teacher1Contact.id;

    // Force one contact into "precontact" state to test activation.
    const teacher2Contact = contacts.find((c) => c.contactId === IDS.teacher2);
    teacher2Contact.status = 'precontact';
    await repository.save(teacher2Contact);
    precontactId = teacher2Contact.id;

    // Force one contact as mandatory to test removal being forbidden.
    const rpContact = contacts.find((c) => c.contactId === IDS.rp1);
    rpContact.mandatory = true;
    await repository.save(rpContact);
    mandatoryContactId = rpContact.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /contacts', () => {
    it('sans token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/contacts');
      expect(res.status).toBe(401);
    });

    it('[COM-BR-010] retourne les contacts actifs autorisés → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const contactIds = res.body.map((c: { contactId: string }) => c.contactId);
      expect(contactIds).toContain(IDS.teacher1);
    });

    it("ne retourne que les contacts du user courant → liste vide pour un autre user", async () => {
      const res = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /contacts/:id/activate', () => {
    it('sans token → 401', async () => {
      const res = await request(app.getHttpServer()).post(`/contacts/${precontactId}/activate`);
      expect(res.status).toBe(401);
    });

    it('id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/contacts/not-a-uuid/activate')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(400);
    });

    it('contact inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/${IDS.unknown}/activate`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(404);
    });

    it('active un precontact → 200 avec status "active"', async () => {
      const res = await request(app.getHttpServer())
        .post(`/contacts/${precontactId}/activate`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('active');
      expect(res.body.id).toBe(precontactId);
    });
  });

  describe('PATCH /contacts/:id/visibility', () => {
    it('sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/contacts/${activeContactId}/visibility`)
        .send({ visibility: 'hidden' });
      expect(res.status).toBe(401);
    });

    it('id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch('/contacts/not-a-uuid/visibility')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ visibility: 'hidden' });
      expect(res.status).toBe(400);
    });

    it('valeur de visibilité invalide → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/contacts/${activeContactId}/visibility`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ visibility: 'invisible' });
      expect(res.status).toBe(400);
    });

    it('contact inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/contacts/${IDS.unknown}/visibility`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ visibility: 'hidden' });
      expect(res.status).toBe(404);
    });

    it('met à jour la visibilité → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/contacts/${activeContactId}/visibility`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ visibility: 'hidden' });

      expect(res.status).toBe(200);
      expect(res.body.visibility).toBe('hidden');
    });
  });

  describe('DELETE /contacts/:id', () => {
    it('sans token → 401', async () => {
      const res = await request(app.getHttpServer()).delete(`/contacts/${activeContactId}`);
      expect(res.status).toBe(401);
    });

    it('id non UUID → 400', async () => {
      const res = await request(app.getHttpServer())
        .delete('/contacts/not-a-uuid')
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(400);
    });

    it('contact inexistant → 404', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/contacts/${IDS.unknown}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(404);
    });

    it('[COM-BR-010] contact obligatoire → 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/contacts/${mandatoryContactId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(403);
    });

    it('retire un contact non obligatoire → 204', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/contacts/${activeContactId}`)
        .set('Authorization', `Bearer ${student1Token}`);
      expect(res.status).toBe(204);
    });
  });
});

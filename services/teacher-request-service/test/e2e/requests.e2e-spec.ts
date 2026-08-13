/**
 * E2E — le flow de la demande de professeur, de bout en bout, contre une vraie
 * base PostgreSQL.
 *
 * Le point central : DEUX formateurs acceptent, et il ne se cree AUCUNE
 * affectation tant que le RP n'a pas tranche. C'est exactement ce que la pile
 * reelle ne faisait pas le 2026-08-11 — deux acceptations produisaient deux
 * affectations actives sur le meme eleve.
 *
 * Etapes couvertes (enonce du 2026-08-12) :
 *   1. l'eleve (ou son parent lie) cree une demande, un seul champ : description
 *   2. le RP dispose de la liste des demandes en cours
 *   3. le RP envoie une proposition aux formateurs de son choix
 *   4. les formateurs acceptent, refusent, ou ne repondent pas
 *   5. le RP lit les reponses et choisit
 *   6. le lien eleve↔formateur est cree dans profile-service
 *   8. la demande traitee disparait de la liste
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

import { createTestApp, makeJwt, IDS, ProfileServiceStub } from './helpers/app.helper';

describe('[E2E] Flow de la demande de professeur', () => {
  let app: INestApplication;
  let profileService: ProfileServiceStub;
  let dataSource: DataSource;

  const studentToken = makeJwt(IDS.student1, 'eleve');
  const parentToken = makeJwt(IDS.parent1, 'parent_financeur');
  const rpToken = makeJwt(IDS.rp1, 'responsable_pedagogique');
  const teacher1Token = makeJwt(IDS.teacher1, 'formateur');
  const teacher2Token = makeJwt(IDS.teacher2, 'formateur');
  const teacher3Token = makeJwt(IDS.teacher3, 'formateur');

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    profileService = testApp.profileService;
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE teacher_proposals, teacher_requests, domain_events, idempotency_records');
    profileService.financeOwnerLinks.clear();
    profileService.administrators.clear();
    profileService.createdTeacherStudentLinks.length = 0;
    profileService.shouldFailLinkCreation = false;
    profileService.shouldConflictOnLinkCreation = false;
    profileService.nonValidatedTeachers.clear();
    profileService.administrators.add(IDS.rp1);
  });

  const createRequestAsStudent = async (description = 'Je voudrais un professeur de maths') => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ description });
    expect(response.status).toBe(201);
    return response.body;
  };

  const sendProposals = async (requestId: string, teacherIds: string[]) => {
    const response = await request(app.getHttpServer())
      .post(`/requests/${requestId}/proposals`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ teacherIds, message: 'Un eleve cherche un professeur', availabilityNote: 'Mercredi soir' });
    expect(response.status).toBe(201);
    return response.body as { id: string; teacherId: string }[];
  };

  // ── Etape 1 ────────────────────────────────────────────────────────────────

  it("l'eleve cree une demande avec le seul champ description", async () => {
    const created = await createRequestAsStudent();

    expect(created).toMatchObject({
      studentId: IDS.student1,
      requesterId: IDS.student1,
      description: 'Je voudrais un professeur de maths',
      status: 'pending',
    });
    expect(created).not.toHaveProperty('subject');
  });

  it('un champ inconnu est refuse explicitement, jamais absorbe', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ description: 'Besoin', urgency: 'haute' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Le champ « urgency » n'est pas attendu par cette route.");
  });

  it('un parent lie peut creer la demande, un parent delie recoit 404', async () => {
    profileService.linkFinanceOwner(IDS.parent1, IDS.student1);
    const allowed = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ description: 'Besoin', studentId: IDS.student1 });
    expect(allowed.status).toBe(201);

    profileService.unlinkFinanceOwner(IDS.parent1, IDS.student1);
    const refused = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ description: 'Besoin', studentId: IDS.student1 });
    expect(refused.status).toBe(404);
  });

  it("la meme cle d'idempotence ne cree pas deux demandes", async () => {
    const send = () =>
      request(app.getHttpServer())
        .post('/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Idempotency-Key', 'cle-unique')
        .send({ description: 'Besoin' });

    const first = await send();
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    const [{ count }] = await dataSource.query('SELECT COUNT(*)::int AS count FROM teacher_requests');
    expect(count).toBe(1);
  });

  // ── Etape 3 : seuls les formateurs valides peuvent recevoir une proposition ─

  it("refuse (400) la proposition a un formateur qui n'est pas valide", async () => {
    profileService.nonValidatedTeachers.set(IDS.teacher1, 'pending');
    const createdRequest = await createRequestAsStudent();

    const response = await request(app.getHttpServer())
      .post(`/requests/${createdRequest.id}/proposals`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ teacherIds: [IDS.teacher1], message: 'Un eleve cherche un professeur' });

    expect(response.status).toBe(400);
    const [{ count }] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM teacher_proposals WHERE request_id = $1',
      [createdRequest.id],
    );
    expect(count).toBe(0);
  });

  it("refuse en entier un envoi groupe des qu'un seul formateur du lot n'est pas valide (atomique)", async () => {
    profileService.nonValidatedTeachers.set(IDS.teacher2, 'in_review');
    const createdRequest = await createRequestAsStudent();

    const response = await request(app.getHttpServer())
      .post(`/requests/${createdRequest.id}/proposals`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ teacherIds: [IDS.teacher1, IDS.teacher2], message: 'Un eleve cherche un professeur' });

    expect(response.status).toBe(400);
    const [{ count }] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM teacher_proposals WHERE request_id = $1',
      [createdRequest.id],
    );
    expect(count).toBe(0);
    const requestRow = await dataSource.query('SELECT status FROM teacher_requests WHERE id = $1', [
      createdRequest.id,
    ]);
    expect(requestRow[0].status).toBe('pending');
  });

  it('accepte la proposition des que tous les formateurs du lot sont valides', async () => {
    const createdRequest = await createRequestAsStudent();

    const proposals = await sendProposals(createdRequest.id, [IDS.teacher1, IDS.teacher2]);

    expect(proposals).toHaveLength(2);
  });

  // ── Etapes 2 a 6 : le flow complet ─────────────────────────────────────────

  it('deux formateurs acceptent : aucune affectation avant la validation du RP', async () => {
    const createdRequest = await createRequestAsStudent();
    const proposals = await sendProposals(createdRequest.id, [IDS.teacher1, IDS.teacher2, IDS.teacher3]);
    const proposalOfTeacher1 = proposals.find((proposal) => proposal.teacherId === IDS.teacher1)!;
    const proposalOfTeacher2 = proposals.find((proposal) => proposal.teacherId === IDS.teacher2)!;

    for (const [token, proposalId] of [
      [teacher1Token, proposalOfTeacher1.id],
      [teacher2Token, proposalOfTeacher2.id],
    ] as const) {
      const accepted = await request(app.getHttpServer())
        .post(`/proposals/${proposalId}/accept`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(accepted.status).toBe(201);
      expect(accepted.body.status).toBe('accepted');
    }

    // Aucune affectation cote profile-service, aucune cloture locale.
    expect(profileService.createdTeacherStudentLinks).toHaveLength(0);
    const detail = await request(app.getHttpServer())
      .get(`/requests/${createdRequest.id}`)
      .set('Authorization', `Bearer ${rpToken}`);
    expect(detail.body.status).toBe('redirected');
    expect(detail.body.acceptedProposalCount).toBe(2);
    expect(detail.body.pendingProposalCount).toBe(1);
  });

  it('la validation du RP cree le lien, cloture la demande et solde les autres propositions', async () => {
    const createdRequest = await createRequestAsStudent();
    const proposals = await sendProposals(createdRequest.id, [IDS.teacher1, IDS.teacher2, IDS.teacher3]);
    const proposalOfTeacher1 = proposals.find((proposal) => proposal.teacherId === IDS.teacher1)!;
    const proposalOfTeacher2 = proposals.find((proposal) => proposal.teacherId === IDS.teacher2)!;

    await request(app.getHttpServer())
      .post(`/proposals/${proposalOfTeacher1.id}/accept`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({});
    await request(app.getHttpServer())
      .post(`/proposals/${proposalOfTeacher2.id}/accept`)
      .set('Authorization', `Bearer ${teacher2Token}`)
      .send({});

    const validated = await request(app.getHttpServer())
      .post(`/requests/${createdRequest.id}/validate`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ proposalId: proposalOfTeacher1.id, isPrincipalTeacher: true });

    expect(validated.status).toBe(201);
    expect(validated.body).toMatchObject({ status: 'closed', chosenTeacherId: IDS.teacher1 });
    expect(profileService.createdTeacherStudentLinks).toEqual([
      { teacherId: IDS.teacher1, studentId: IDS.student1, isPrincipalTeacher: true },
    ]);

    const proposalStatuses = await dataSource.query(
      'SELECT teacher_id, status FROM teacher_proposals WHERE request_id = $1 ORDER BY teacher_id',
      [createdRequest.id],
    );
    expect(proposalStatuses).toEqual([
      { teacher_id: IDS.teacher1, status: 'accepted' },
      { teacher_id: IDS.teacher2, status: 'not_selected' },
      { teacher_id: IDS.teacher3, status: 'expired' },
    ]);
  });

  it('la demande traitee disparait de la liste par defaut et reste lisible en scope=closed', async () => {
    const createdRequest = await createRequestAsStudent();
    const [proposal] = await sendProposals(createdRequest.id, [IDS.teacher1]);
    await request(app.getHttpServer())
      .post(`/proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({});
    await request(app.getHttpServer())
      .post(`/requests/${createdRequest.id}/validate`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ proposalId: proposal.id });

    const openList = await request(app.getHttpServer())
      .get('/requests')
      .set('Authorization', `Bearer ${rpToken}`);
    expect(openList.body).toHaveLength(0);

    const closedList = await request(app.getHttpServer())
      .get('/requests?scope=closed')
      .set('Authorization', `Bearer ${rpToken}`);
    expect(closedList.body).toHaveLength(1);
  });

  it('si profile-service refuse le lien, la demande reste ouverte', async () => {
    const createdRequest = await createRequestAsStudent();
    const [proposal] = await sendProposals(createdRequest.id, [IDS.teacher1]);
    await request(app.getHttpServer())
      .post(`/proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({});
    profileService.shouldFailLinkCreation = true;

    const validated = await request(app.getHttpServer())
      .post(`/requests/${createdRequest.id}/validate`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ proposalId: proposal.id });

    expect(validated.status).toBeGreaterThanOrEqual(500);
    const [row] = await dataSource.query('SELECT status FROM teacher_requests WHERE id = $1', [
      createdRequest.id,
    ]);
    expect(row.status).toBe('redirected');
  });

  it('un lien contradictoire est remonte au RP en 409, jamais affiche comme un succes', async () => {
    const createdRequest = await createRequestAsStudent();
    const [proposal] = await sendProposals(createdRequest.id, [IDS.teacher1]);
    await request(app.getHttpServer())
      .post(`/proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({});
    profileService.shouldConflictOnLinkCreation = true;

    const validated = await request(app.getHttpServer())
      .post(`/requests/${createdRequest.id}/validate`)
      .set('Authorization', `Bearer ${rpToken}`)
      .send({ proposalId: proposal.id, isPrincipalTeacher: true });

    expect(validated.status).toBe(409);
    expect(validated.body.message).toContain('professeur principal');
    const [row] = await dataSource.query('SELECT status FROM teacher_requests WHERE id = $1', [
      createdRequest.id,
    ]);
    expect(row.status).toBe('redirected');
  });

  // ── Etape 4 : ce que voit le formateur ─────────────────────────────────────

  it("le formateur voit la description et le nom de l'eleve, et lit la demande", async () => {
    const createdRequest = await createRequestAsStudent('Besoin en trigonometrie');
    const [proposal] = await sendProposals(createdRequest.id, [IDS.teacher1]);

    const inbox = await request(app.getHttpServer())
      .get('/requests')
      .set('Authorization', `Bearer ${teacher1Token}`);

    expect(inbox.status).toBe(200);
    expect(inbox.body[0]).toMatchObject({
      id: proposal.id,
      requestDescription: 'Besoin en trigonometrie',
      message: 'Un eleve cherche un professeur',
      availabilityNote: 'Mercredi soir',
      status: 'pending',
    });
    expect(inbox.body[0].studentName).toEqual(expect.any(String));

    const detail = await request(app.getHttpServer())
      .get(`/requests/${createdRequest.id}`)
      .set('Authorization', `Bearer ${teacher1Token}`);
    expect(detail.status).toBe(200);
  });

  it("un formateur non sollicite ne sait pas que la demande existe", async () => {
    const createdRequest = await createRequestAsStudent();

    const detail = await request(app.getHttpServer())
      .get(`/requests/${createdRequest.id}`)
      .set('Authorization', `Bearer ${teacher2Token}`);

    expect(detail.status).toBe(404);
  });

  it('un formateur ne repond pas deux fois a la meme proposition', async () => {
    const createdRequest = await createRequestAsStudent();
    const [proposal] = await sendProposals(createdRequest.id, [IDS.teacher1]);

    await request(app.getHttpServer())
      .post(`/proposals/${proposal.id}/decline`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({});
    const secondAnswer = await request(app.getHttpServer())
      .post(`/proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({});

    expect(secondAnswer.status).toBe(400);
    expect(secondAnswer.body.message).toBe('Vous avez deja repondu a cette proposition.');
  });

  // ── Etape 5 : la lecture du RP ─────────────────────────────────────────────

  it('le RP lit les reponses des formateurs', async () => {
    const createdRequest = await createRequestAsStudent();
    const proposals = await sendProposals(createdRequest.id, [IDS.teacher1, IDS.teacher2]);
    await request(app.getHttpServer())
      .post(`/proposals/${proposals[0].id}/decline`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({});

    const readProposals = await request(app.getHttpServer())
      .get(`/requests/${createdRequest.id}/proposals`)
      .set('Authorization', `Bearer ${rpToken}`);

    expect(readProposals.status).toBe(200);
    expect(readProposals.body).toHaveLength(2);
    expect(readProposals.body.map((proposal: { status: string }) => proposal.status).sort()).toEqual([
      'declined',
      'pending',
    ]);
    expect(readProposals.body[0].teacherName).toEqual(expect.any(String));
  });

  it("l'eleve ne lit pas les candidatures", async () => {
    const createdRequest = await createRequestAsStudent();

    const readProposals = await request(app.getHttpServer())
      .get(`/requests/${createdRequest.id}/proposals`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(readProposals.status).toBe(403);
  });

  // ── Evenements ─────────────────────────────────────────────────────────────

  it('le flow ecrit de vrais evenements en base, avec leur correlation', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .set('x-correlation-id', 'corr-e2e')
      .send({ description: 'Besoin' });

    expect(response.headers['x-correlation-id']).toBe('corr-e2e');
    const events = await dataSource.query(
      'SELECT event_name, correlation_id, published_at FROM domain_events WHERE aggregate_id = $1',
      [response.body.id],
    );
    expect(events).toEqual([
      { event_name: 'TeacherRequestCreated', correlation_id: 'corr-e2e', published_at: null },
    ]);
  });

  // ── Authentification ───────────────────────────────────────────────────────

  it('toutes les routes exigent un jeton valide', async () => {
    const withoutToken = await request(app.getHttpServer()).get('/requests');
    expect(withoutToken.status).toBe(401);

    const withBadToken = await request(app.getHttpServer())
      .get(`/requests/${IDS.unknown}`)
      .set('Authorization', 'Bearer pas.un.jeton');
    expect(withBadToken.status).toBe(401);
  });

  it('une demande inexistante renvoie 404', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/requests/${IDS.unknown}`)
      .set('Authorization', `Bearer ${rpToken}`);

    expect(detail.status).toBe(404);
  });
});

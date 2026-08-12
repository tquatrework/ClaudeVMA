/**
 * Tests HTTP de la couche controleur : authentification, garde de role,
 * `ParseUUIDPipe`, validation de corps (dont le refus des champs inconnus) et
 * serialisation vers les DTO de reponse.
 *
 * Le service est entierement simule : seule la chaine HTTP est exercee
 * (middleware → gardes → pipes → controleur → reponse), avec les vraies gardes
 * et le vrai `ValidationPipe` du service.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';

import { TeacherRequestController } from '../../src/teacher-request/teacher-request.controller';
import { RequestProposalsController } from '../../src/teacher-request/request-proposals.controller';
import { ProposalController } from '../../src/teacher-request/proposal.controller';
import { TeacherRequestService } from '../../src/teacher-request/teacher-request.service';
import { IdempotencyService } from '../../src/idempotency/idempotency.service';
import { JwtAuthGuard } from '../../src/common/jwt.guard';
import { RolesGuard } from '../../src/common/roles.guard';
import { CorrelationIdMiddleware } from '../../src/common/correlation-id.middleware';
import { createValidationPipe } from '../../src/common/validation.pipe';
import { UserRole } from '../../src/common/user-role.enum';
import { RequestStatus, RequestType } from '../../src/teacher-request/entities/teacher-request.entity';
import { ProposalStatus } from '../../src/teacher-request/entities/teacher-proposal.entity';

const JWT_SECRET = 'unit-test-secret';
// UUID de version 4 : `ParseUUIDPipe` refuse les autres versions.
const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const OTHER_UUID = '22222222-2222-4222-8222-222222222222';

function makeToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role, type: 'access' }, JWT_SECRET, { expiresIn: '1h' });
}

const savedRequest = {
  id: VALID_UUID,
  requesterId: 'parent-1',
  requesterRole: UserRole.PARENT_FINANCEUR,
  studentId: VALID_UUID,
  studentName: 'Alice Dupont',
  description: 'Je voudrais un professeur de maths',
  status: RequestStatus.PENDING,
  type: RequestType.SPECIFIC,
  currentPpTeacherId: null,
  chosenTeacherId: null,
  chosenTeacherName: null,
  closedAt: null,
  createdAt: new Date('2026-08-12T00:00:00.000Z'),
  updatedAt: new Date('2026-08-12T00:00:00.000Z'),
};

describe('[HTTP] chaine controleur — gardes, pipes, serialisation', () => {
  let app: INestApplication;
  let mockService: Record<string, jest.Mock>;

  beforeAll(async () => {
    mockService = {
      createRequest: jest.fn().mockResolvedValue(savedRequest),
      listRequests: jest.fn().mockResolvedValue([]),
      listProposalsForTeacher: jest.fn().mockResolvedValue([]),
      getRequest: jest.fn().mockResolvedValue(savedRequest),
      updateRequestStatus: jest.fn().mockResolvedValue(savedRequest),
      validateCandidate: jest.fn().mockResolvedValue(savedRequest),
      deleteRequest: jest.fn().mockResolvedValue(undefined),
      createPpChangeRequest: jest.fn().mockResolvedValue(savedRequest),
      createProposals: jest.fn().mockResolvedValue([]),
      listProposalsOfRequest: jest.fn().mockResolvedValue([]),
      acceptProposal: jest.fn(),
      declineProposal: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [TeacherRequestController, RequestProposalsController, ProposalController],
      providers: [
        { provide: TeacherRequestService, useValue: mockService },
        // Sans cle d'idempotence, la commande s'execute normalement.
        { provide: IdempotencyService, useValue: { runOnce: jest.fn((_params, command) => command()) } },
        { provide: ConfigService, useValue: { getOrThrow: () => JWT_SECRET, get: () => undefined } },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(new CorrelationIdMiddleware().use.bind(new CorrelationIdMiddleware()));
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.createRequest.mockResolvedValue(savedRequest);
    mockService.listRequests.mockResolvedValue([]);
    mockService.listProposalsForTeacher.mockResolvedValue([]);
  });

  it('401 — aucun jeton', async () => {
    const response = await request(app.getHttpServer()).get('/requests');
    expect(response.status).toBe(401);
  });

  it('403 — role non declare par @Roles', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests/pp-change')
      .set('Authorization', `Bearer ${makeToken('teacher-1', UserRole.FORMATEUR)}`)
      .send({ studentId: VALID_UUID, description: 'Motif' });

    expect(response.status).toBe(403);
    expect(mockService.createPpChangeRequest).not.toHaveBeenCalled();
  });

  it('400 — identifiant de route mal forme', async () => {
    const response = await request(app.getHttpServer())
      .get('/requests/pas-un-uuid')
      .set('Authorization', `Bearer ${makeToken('rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE)}`);

    expect(response.status).toBe(400);
    expect(mockService.getRequest).not.toHaveBeenCalled();
  });

  it('400 en francais — description manquante', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('La description est obligatoire.');
    expect(mockService.createRequest).not.toHaveBeenCalled();
  });

  it('400 — un champ inconnu est refuse, jamais absorbe en silence', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`)
      .send({ description: 'Besoin', urgency: 'haute' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Le champ « urgency » n'est pas attendu par cette route.");
    expect(mockService.createRequest).not.toHaveBeenCalled();
  });

  it('400 — `subject` est sorti du flow et n\'est plus accepte', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`)
      .send({ description: 'Besoin', subject: 'Mathematiques' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Le champ « subject » n'est pas attendu par cette route.");
  });

  it('201 — creation nominale, reponse serialisee et sans champ herite', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`)
      .send({ description: 'Je voudrais un professeur de maths' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: VALID_UUID,
      status: 'pending',
      description: 'Je voudrais un professeur de maths',
      studentName: 'Alice Dupont',
    });
    expect(response.body).not.toHaveProperty('subject');
    expect(response.body).not.toHaveProperty('selectedTeacherIds');
  });

  it('renvoie le x-correlation-id fourni par l\'appelant', async () => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`)
      .set('x-correlation-id', 'corr-abc')
      .send({ description: 'Besoin' });

    expect(response.headers['x-correlation-id']).toBe('corr-abc');
    expect(mockService.createRequest).toHaveBeenCalledWith(
      { description: 'Besoin' },
      expect.objectContaining({ correlationId: 'corr-abc' }),
    );
  });

  it('genere un x-correlation-id quand l\'appelant n\'en fournit pas', async () => {
    const response = await request(app.getHttpServer())
      .get('/requests')
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`);

    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
    expect(response.headers['x-correlation-id'].length).toBeGreaterThan(0);
  });

  it('la forme de la liste depend du role, pas du contenu : un formateur lit sa boite', async () => {
    await request(app.getHttpServer())
      .get('/requests')
      .set('Authorization', `Bearer ${makeToken('teacher-1', UserRole.FORMATEUR)}`);

    expect(mockService.listProposalsForTeacher).toHaveBeenCalled();
    expect(mockService.listRequests).not.toHaveBeenCalled();
  });

  it('scope=closed est transmis au service', async () => {
    await request(app.getHttpServer())
      .get('/requests?scope=closed')
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`);

    expect(mockService.listRequests).toHaveBeenCalledWith(expect.anything(), 'closed');
  });

  it('400 — statut hors des valeurs posables a la main', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/requests/${VALID_UUID}/status`)
      .set('Authorization', `Bearer ${makeToken('rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE)}`)
      .send({ status: 'pending' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(
      'Le statut doit valoir « declined », « cancelled » ou « closed ».',
    );
  });

  it('403 — seul le RP valide un candidat', async () => {
    const response = await request(app.getHttpServer())
      .post(`/requests/${VALID_UUID}/validate`)
      .set('Authorization', `Bearer ${makeToken('student-1', UserRole.ELEVE)}`)
      .send({ proposalId: OTHER_UUID });

    expect(response.status).toBe(403);
    expect(mockService.validateCandidate).not.toHaveBeenCalled();
  });

  it('201 — le RP valide un candidat', async () => {
    const response = await request(app.getHttpServer())
      .post(`/requests/${VALID_UUID}/validate`)
      .set('Authorization', `Bearer ${makeToken('rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE)}`)
      .send({ proposalId: OTHER_UUID, isPrincipalTeacher: true });

    expect(response.status).toBe(201);
    expect(mockService.validateCandidate).toHaveBeenCalledWith(
      VALID_UUID,
      { proposalId: OTHER_UUID, isPrincipalTeacher: true },
      expect.anything(),
    );
  });

  it('400 — envoi de proposition sans destinataire', async () => {
    const response = await request(app.getHttpServer())
      .post(`/requests/${VALID_UUID}/proposals`)
      .set('Authorization', `Bearer ${makeToken('rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE)}`)
      .send({ teacherIds: [], message: 'Voici le besoin' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Choisissez au moins un formateur.');
  });

  it('400 — envoi de proposition sans message', async () => {
    const response = await request(app.getHttpServer())
      .post(`/requests/${VALID_UUID}/proposals`)
      .set('Authorization', `Bearer ${makeToken('rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE)}`)
      .send({ teacherIds: [OTHER_UUID] });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Le message a destination des formateurs est obligatoire.');
  });

  it('201 — envoi groupe accepte les trois champs indicatifs', async () => {
    mockService.createProposals.mockResolvedValue([]);
    const response = await request(app.getHttpServer())
      .post(`/requests/${VALID_UUID}/proposals`)
      .set('Authorization', `Bearer ${makeToken('rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE)}`)
      .send({
        teacherIds: [OTHER_UUID],
        message: 'Voici le besoin',
        availabilityNote: 'Mercredi soir',
        compensationNote: '40 EUR / heure',
        responseDeadline: '2026-09-01',
      });

    expect(response.status).toBe(201);
    expect(mockService.createProposals).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({ availabilityNote: 'Mercredi soir', responseDeadline: '2026-09-01' }),
      expect.anything(),
    );
  });

  it('403 — un formateur ne lit pas les candidatures d\'une demande', async () => {
    const response = await request(app.getHttpServer())
      .get(`/requests/${VALID_UUID}/proposals`)
      .set('Authorization', `Bearer ${makeToken('teacher-1', UserRole.FORMATEUR)}`);

    expect(response.status).toBe(403);
  });

  it('201 — l\'acceptation renvoie une proposition, jamais une affectation', async () => {
    mockService.acceptProposal.mockResolvedValue({
      id: OTHER_UUID,
      requestId: VALID_UUID,
      teacherId: 'teacher-1',
      message: 'Voici le besoin',
      availabilityNote: null,
      compensationNote: null,
      responseDeadline: null,
      status: ProposalStatus.ACCEPTED,
      respondedAt: new Date('2026-08-12T12:00:00.000Z'),
      createdAt: new Date('2026-08-12T10:00:00.000Z'),
      updatedAt: new Date('2026-08-12T12:00:00.000Z'),
      requestDescription: 'Je voudrais un professeur de maths',
      requestStatus: RequestStatus.REDIRECTED,
      requestCreatedAt: new Date('2026-08-12T09:00:00.000Z'),
      studentName: 'Alice Dupont',
    });

    const response = await request(app.getHttpServer())
      .post(`/proposals/${OTHER_UUID}/accept`)
      .set('Authorization', `Bearer ${makeToken('teacher-1', UserRole.FORMATEUR)}`)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'accepted',
      requestDescription: 'Je voudrais un professeur de maths',
      studentName: 'Alice Dupont',
    });
    expect(response.body).not.toHaveProperty('assignmentId');
    expect(response.body).not.toHaveProperty('studentId');
  });
});

/**
 * Ce que le controleur decide lui-meme, independamment du service :
 * l'aiguillage de la forme de reponse selon le ROLE, et le passage par
 * l'idempotence sur les commandes.
 */
import { Test, TestingModule } from '@nestjs/testing';

import { TeacherRequestController } from '../../src/teacher-request/teacher-request.controller';
import { RequestProposalsController } from '../../src/teacher-request/request-proposals.controller';
import { RequestScope, TeacherRequestService } from '../../src/teacher-request/teacher-request.service';
import { IdempotencyService } from '../../src/idempotency/idempotency.service';
import { JwtAuthGuard } from '../../src/common/jwt.guard';
import { RolesGuard } from '../../src/common/roles.guard';
import { RequestContext } from '../../src/common/request-context.decorator';
import { UserRole } from '../../src/common/user-role.enum';
import { RequestStatus, RequestType } from '../../src/teacher-request/entities/teacher-request.entity';
import { ProposalStatus } from '../../src/teacher-request/entities/teacher-proposal.entity';

const buildContext = (role: string, idempotencyKey?: string): RequestContext => ({
  user: { id: 'user-1', role, loginIdentifier: 'user.one' },
  correlationId: 'corr-1',
  idempotencyKey,
});

const requestEntity = {
  id: 'request-1',
  requesterId: 'user-1',
  requesterRole: UserRole.ELEVE,
  studentId: 'student-1',
  studentName: 'Alice Dupont',
  description: 'Besoin en maths',
  status: RequestStatus.PENDING,
  type: RequestType.SPECIFIC,
  currentPpTeacherId: null,
  chosenTeacherId: null,
  chosenTeacherName: null,
  closedAt: null,
  createdAt: new Date('2026-08-12T00:00:00.000Z'),
  updatedAt: new Date('2026-08-12T00:00:00.000Z'),
};

const inboxEntity = {
  id: 'proposal-1',
  requestId: 'request-1',
  teacherId: 'user-1',
  message: 'Voici le besoin',
  availabilityNote: null,
  compensationNote: null,
  responseDeadline: null,
  status: ProposalStatus.PENDING,
  respondedAt: null,
  createdAt: new Date('2026-08-12T00:00:00.000Z'),
  updatedAt: new Date('2026-08-12T00:00:00.000Z'),
  requestDescription: 'Besoin en maths',
  requestStatus: RequestStatus.REDIRECTED,
  requestCreatedAt: new Date('2026-08-12T00:00:00.000Z'),
  studentName: 'Alice Dupont',
};

describe('TeacherRequestController', () => {
  let controller: TeacherRequestController;
  let proposalsController: RequestProposalsController;
  let service: Record<string, jest.Mock>;
  let idempotency: { runOnce: jest.Mock };

  beforeEach(async () => {
    service = {
      createRequest: jest.fn().mockResolvedValue(requestEntity),
      listRequests: jest.fn().mockResolvedValue([requestEntity]),
      listProposalsForTeacher: jest.fn().mockResolvedValue([inboxEntity]),
      createProposals: jest.fn().mockResolvedValue([]),
      listProposalsOfRequest: jest.fn().mockResolvedValue([]),
    };
    idempotency = { runOnce: jest.fn((_parameters, command) => command()) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TeacherRequestController, RequestProposalsController],
      providers: [
        { provide: TeacherRequestService, useValue: service },
        { provide: IdempotencyService, useValue: idempotency },
      ],
    })
      // Les gardes sont exercees par le test HTTP ; on teste ici les seules
      // decisions du controleur.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(TeacherRequestController);
    proposalsController = moduleRef.get(RequestProposalsController);
  });

  it('un formateur recoit sa boite de reception, pas des demandes', async () => {
    const results = await controller.listRequests(buildContext(UserRole.FORMATEUR));

    expect(service.listProposalsForTeacher).toHaveBeenCalled();
    expect(results[0]).toMatchObject({ requestDescription: 'Besoin en maths', studentName: 'Alice Dupont' });
  });

  it('un eleve recoit des demandes', async () => {
    const results = await controller.listRequests(buildContext(UserRole.ELEVE));

    expect(service.listRequests).toHaveBeenCalled();
    expect(results[0]).toMatchObject({ description: 'Besoin en maths' });
  });

  it('une liste vide garde la forme du role, jamais devinee sur le contenu', async () => {
    service.listProposalsForTeacher.mockResolvedValue([]);

    await expect(controller.listRequests(buildContext(UserRole.FORMATEUR))).resolves.toEqual([]);
    expect(service.listRequests).not.toHaveBeenCalled();
  });

  it('le perimetre par defaut est « en cours »', async () => {
    await controller.listRequests(buildContext(UserRole.ELEVE));

    expect(service.listRequests).toHaveBeenCalledWith(expect.anything(), RequestScope.OPEN);
  });

  it('la creation passe par l\'idempotence, avec la route comme perimetre', async () => {
    await controller.createRequest({ description: 'Besoin' }, buildContext(UserRole.ELEVE, 'cle-1'));

    expect(idempotency.runOnce).toHaveBeenCalledWith(
      { idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' },
      expect.any(Function),
    );
  });

  it('un rejeu renvoie la reponse conservee sans reexecuter la commande', async () => {
    idempotency.runOnce.mockResolvedValue({ id: 'request-1', status: RequestStatus.PENDING });

    const replayed = await controller.createRequest(
      { description: 'Besoin' },
      buildContext(UserRole.ELEVE, 'cle-1'),
    );

    expect(replayed).toEqual({ id: 'request-1', status: RequestStatus.PENDING });
    expect(service.createRequest).not.toHaveBeenCalled();
  });

  it('l\'envoi groupe de propositions est lui aussi rejouable', async () => {
    await proposalsController.createProposals(
      'request-1',
      { teacherIds: ['teacher-1'], message: 'Voici' },
      buildContext(UserRole.RESPONSABLE_PEDAGOGIQUE, 'cle-2'),
    );

    expect(idempotency.runOnce).toHaveBeenCalledWith(
      { idempotencyKey: 'cle-2', endpoint: 'POST /requests/request-1/proposals', userId: 'user-1' },
      expect.any(Function),
    );
  });
});

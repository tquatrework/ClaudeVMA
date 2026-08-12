import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import {
  TeacherRequest,
  RequestStatus,
  RequestType,
  TERMINAL_REQUEST_STATUSES,
} from './entities/teacher-request.entity';
import { TeacherProposal, ProposalStatus } from './entities/teacher-proposal.entity';
import { Assignment, AssignmentStatus } from './entities/assignment.entity';
import { TerminationRequest } from './entities/termination-request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { CreatePpChangeDto } from './dto/create-pp-change.dto';
import { ValidateCandidateDto } from './dto/validate-candidate.dto';
import { ManualRequestStatus } from './dto/update-status.dto';
import { TeacherRequestWithNames } from './dto/response/teacher-request-response.dto';
import { TeacherProposalWithTeacherName } from './dto/response/teacher-proposal-response.dto';
import { TeacherProposalWithRequest } from './dto/response/teacher-proposal-inbox.dto';
import { EventsService, TeacherRequestEvent } from '../events/events.service';
import { ProfileServiceClient, OutboundCallContext } from './clients/profile-service.client';
import { RequestContext } from '../common/request-context.decorator';
import { UserRole } from '../common/user-role.enum';

/** Relation « ce financeur finance cet eleve », vue du financeur. */
const FINANCE_OWNER_OF_STUDENT = 'finance_owner_of_student';

/** Perimetre de lecture d'une liste de demandes. */
export enum RequestScope {
  /** Demandes encore a traiter — ce que voit l'interface par defaut. */
  OPEN = 'open',
  /** Demandes traitees, conservees comme historique. */
  CLOSED = 'closed',
  ALL = 'all',
}

/**
 * Message unique servant a la fois pour « cet eleve n'existe pas » et « vous
 * n'avez aucun lien avec cet eleve ».
 *
 * Les distinguer reviendrait a confirmer l'existence d'un compte a qui n'a pas
 * le droit de le savoir — meme regle que les medias masques (2026-08-10) et les
 * statistiques sans relation (2026-08-11).
 */
const UNKNOWN_STUDENT_MESSAGE = "Aucun eleve correspondant n'a ete trouve.";

/**
 * Cohesion note (services-convention.md §"À partir de 300 lignes..."):
 * this service intentionally owns four repositories (TeacherRequest,
 * TeacherProposal, Assignment, TerminationRequest) because they form a
 * single lifecycle aggregate — request → proposal → assignment →
 * termination — with no independent existence or reuse outside this flow.
 *
 * Attention : depuis l'arbitrage du 2026-08-12, `Assignment` n'est PLUS
 * alimente par le flow. Le lien eleve↔formateur appartient a profile-service ;
 * la table ne conserve que les affectations creees par l'ancien modele, dont
 * dependent encore les routes d'arret de collaboration (hors flow).
 */
@Injectable()
export class TeacherRequestService {
  constructor(
    @InjectRepository(TeacherRequest) private readonly requestRepo: Repository<TeacherRequest>,
    @InjectRepository(TeacherProposal) private readonly proposalRepo: Repository<TeacherProposal>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(TerminationRequest) private readonly terminationRepo: Repository<TerminationRequest>,
    private readonly events: EventsService,
    private readonly dataSource: DataSource,
    private readonly profileServiceClient: ProfileServiceClient,
  ) {}

  // ── Contexte des appels sortants ───────────────────────────────────────────

  private toOutboundContext(context: RequestContext): OutboundCallContext {
    return {
      correlationId: context.correlationId,
      callerAuthorization: context.callerAuthorization,
    };
  }

  // ── Droit d'agir ───────────────────────────────────────────────────────────

  /**
   * Verifie, AU MOMENT DE L'ACTION, que l'appelant a le droit d'agir pour cet
   * eleve.
   *
   * Jamais mis en cache, jamais fige a la creation de la demande : depuis la
   * PR #98 un lien parent↔eleve peut etre rompu, et un parent delie doit cesser
   * d'agir immediatement, y compris sur une demande qu'il avait legitimement
   * creee avant la rupture (arbitrage du 2026-08-12, point 6).
   */
  private async assertCanActForStudent(studentId: string, context: RequestContext): Promise<void> {
    const { user } = context;

    if (user.role === UserRole.ELEVE) {
      if (user.id !== studentId) throw new NotFoundException(UNKNOWN_STUDENT_MESSAGE);
      return;
    }

    const rolesAllowedToActForOthers = [UserRole.PARENT_FINANCEUR, UserRole.RESPONSABLE_PEDAGOGIQUE];
    if (!rolesAllowedToActForOthers.includes(user.role as UserRole)) {
      throw new ForbiddenException("Votre role ne permet pas de demander un professeur pour un eleve.");
    }

    const relationLookup = await this.profileServiceClient.getRelations(
      user.id,
      studentId,
      user.role,
      this.toOutboundContext(context),
    );
    if (relationLookup.isAdministrator) return;

    const isFinanceOwnerOfStudent = relationLookup.relations.some(
      (relation) => relation.kind === FINANCE_OWNER_OF_STUDENT,
    );
    // Un studentId sur lequel l'appelant n'a aucun lien ne doit pas reveler
    // l'existence de l'eleve : 404, jamais 403.
    if (!isFinanceOwnerOfStudent) throw new NotFoundException(UNKNOWN_STUDENT_MESSAGE);
  }

  private isAdministratorRole(role: string): boolean {
    return (
      [
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        UserRole.ADMINISTRATEUR_FINANCIER,
        UserRole.TECHNICIEN_INFORMATIQUE,
      ] as string[]
    ).includes(role);
  }

  // ── Resolution des noms ────────────────────────────────────────────────────

  private async enrichRequestsWithNames(
    requests: TeacherRequest[],
    context: RequestContext,
  ): Promise<TeacherRequestWithNames[]> {
    const outboundContext = this.toOutboundContext(context);
    const namesById = await this.resolveDisplayNames(
      requests.flatMap((request) => [request.studentId, request.chosenTeacherId].filter(Boolean) as string[]),
      outboundContext,
    );
    return requests.map((request) => ({
      ...request,
      studentName: namesById.get(request.studentId) ?? null,
      chosenTeacherName: request.chosenTeacherId ? namesById.get(request.chosenTeacherId) ?? null : null,
    }));
  }

  /** Une seule resolution par identifiant, meme s'il apparait sur dix demandes. */
  private async resolveDisplayNames(
    userIds: string[],
    outboundContext: OutboundCallContext,
  ): Promise<Map<string, string | null>> {
    const uniqueUserIds = [...new Set(userIds)];
    const resolvedNames = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const displayName = await this.profileServiceClient.resolveDisplayName(userId, outboundContext);
        return [userId, displayName] as const;
      }),
    );
    return new Map(resolvedNames);
  }

  // ── Etape 1 : creation de la demande ───────────────────────────────────────

  async createRequest(dto: CreateRequestDto, context: RequestContext): Promise<TeacherRequestWithNames> {
    const { user } = context;
    const allowedRoles = [UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.RESPONSABLE_PEDAGOGIQUE];
    if (!allowedRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException("Votre role ne permet pas de creer une demande de professeur.");
    }

    const studentId = user.role === UserRole.ELEVE ? user.id : dto.studentId;
    if (!studentId) {
      throw new BadRequestException("Precisez l'eleve concerne par la demande.");
    }
    await this.assertCanActForStudent(studentId, context);

    const savedRequest = await this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(TeacherRequest);
      const created = await requestRepository.save(
        requestRepository.create({
          requesterId: user.id,
          requesterRole: user.role,
          studentId,
          description: dto.description,
          status: RequestStatus.PENDING,
          type: RequestType.SPECIFIC,
        }),
      );
      await this.events.record(
        {
          eventName: TeacherRequestEvent.REQUEST_CREATED,
          aggregateType: 'TeacherRequest',
          aggregateId: created.id,
          payload: {
            requestId: created.id,
            studentId,
            requesterId: user.id,
            requesterRole: user.role,
            type: RequestType.SPECIFIC,
          },
          correlationId: context.correlationId,
        },
        manager,
      );
      return created;
    });
    this.events.requestPublication();

    const [enriched] = await this.enrichRequestsWithNames([savedRequest], context);
    return enriched;
  }

  async createPpChangeRequest(
    dto: CreatePpChangeDto,
    context: RequestContext,
  ): Promise<TeacherRequestWithNames> {
    const { user } = context;
    if (user.role !== UserRole.PARENT_FINANCEUR) {
      throw new ForbiddenException(
        'Seul un parent financeur peut demander un changement de professeur principal.',
      );
    }
    // Le trou documente dans le code depuis des mois (« quand profile-service
    // exposera un endpoint /verify-link ») est ici referme : la route existe.
    await this.assertCanActForStudent(dto.studentId, context);

    const savedRequest = await this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(TeacherRequest);
      const created = await requestRepository.save(
        requestRepository.create({
          requesterId: user.id,
          requesterRole: user.role,
          studentId: dto.studentId,
          description: dto.description,
          currentPpTeacherId: dto.currentPpTeacherId,
          type: RequestType.PP_CHANGE,
          status: RequestStatus.PENDING,
        }),
      );
      await this.events.record(
        {
          eventName: TeacherRequestEvent.REQUEST_CREATED,
          aggregateType: 'TeacherRequest',
          aggregateId: created.id,
          payload: {
            requestId: created.id,
            studentId: dto.studentId,
            requesterId: user.id,
            requesterRole: user.role,
            type: RequestType.PP_CHANGE,
          },
          correlationId: context.correlationId,
        },
        manager,
      );
      return created;
    });
    this.events.requestPublication();

    const [enriched] = await this.enrichRequestsWithNames([savedRequest], context);
    return enriched;
  }

  // ── Etape 2 : lecture des demandes ─────────────────────────────────────────

  private statusesForScope(scope: RequestScope): RequestStatus[] | undefined {
    if (scope === RequestScope.ALL) return undefined;
    const allStatuses = Object.values(RequestStatus);
    return scope === RequestScope.CLOSED
      ? allStatuses.filter((status) => TERMINAL_REQUEST_STATUSES.includes(status))
      : allStatuses.filter((status) => !TERMINAL_REQUEST_STATUSES.includes(status));
  }

  /**
   * Etape 8 du flow : une demande traitee disparait de la liste par defaut.
   * Elle reste lisible avec `scope=closed` ou `scope=all` — disparaitre d'un
   * ecran n'est pas etre effacee.
   */
  async listRequests(
    context: RequestContext,
    scope: RequestScope = RequestScope.OPEN,
  ): Promise<TeacherRequestWithNames[]> {
    const { user } = context;
    const statuses = this.statusesForScope(scope);
    const statusFilter = statuses ? { status: In(statuses) } : {};

    switch (user.role) {
      case UserRole.ELEVE: {
        const studentRequests = await this.requestRepo.find({
          where: { studentId: user.id, ...statusFilter },
          order: { createdAt: 'DESC' },
        });
        return this.enrichRequestsWithNames(studentRequests, context);
      }
      case UserRole.PARENT_FINANCEUR: {
        const parentRequests = await this.requestRepo.find({
          where: { requesterId: user.id, ...statusFilter },
          order: { createdAt: 'DESC' },
        });
        const stillLinkedRequests = await this.filterRequestsStillLinkedToParent(parentRequests, context);
        return this.enrichRequestsWithNames(stillLinkedRequests, context);
      }
      case UserRole.RESPONSABLE_PEDAGOGIQUE: {
        const rpRequests = await this.requestRepo.find({
          where: { ...statusFilter },
          order: { createdAt: 'DESC' },
        });
        // Le RP lit des NOMS, jamais des UUID (arbitrage du 2026-08-09) : la
        // resolution est faite ici, et les compteurs lui evitent d'ouvrir
        // chaque demande pour savoir si quelqu'un a repondu.
        const enrichedRequests = await this.enrichRequestsWithNames(rpRequests, context);
        return this.attachProposalCounts(enrichedRequests);
      }
      default:
        throw new ForbiddenException("Votre role ne permet pas de consulter les demandes de professeur.");
    }
  }

  /**
   * Un parent delie cesse de voir les demandes de l'eleve concerne, meme
   * celles qu'il a lui-meme creees. Le lien est reinterroge a chaque lecture.
   */
  private async filterRequestsStillLinkedToParent(
    requests: TeacherRequest[],
    context: RequestContext,
  ): Promise<TeacherRequest[]> {
    const uniqueStudentIds = [...new Set(requests.map((request) => request.studentId))];
    const linkedStudentIds = new Set<string>();
    await Promise.all(
      uniqueStudentIds.map(async (studentId) => {
        const relationLookup = await this.profileServiceClient.getRelations(
          context.user.id,
          studentId,
          context.user.role,
          this.toOutboundContext(context),
        );
        const isStillLinked = relationLookup.relations.some(
          (relation) => relation.kind === FINANCE_OWNER_OF_STUDENT,
        );
        if (isStillLinked) linkedStudentIds.add(studentId);
      }),
    );
    return requests.filter((request) => linkedStudentIds.has(request.studentId));
  }

  /** Le RP a besoin de savoir, sans ouvrir chaque demande, qui a repondu. */
  private async attachProposalCounts(
    requests: TeacherRequestWithNames[],
  ): Promise<TeacherRequestWithNames[]> {
    if (requests.length === 0) return [];
    const proposals = await this.proposalRepo.find({
      where: { requestId: In(requests.map((request) => request.id)) },
    });
    return requests.map((request) => {
      const proposalsOfRequest = proposals.filter((proposal) => proposal.requestId === request.id);
      return {
        ...request,
        acceptedProposalCount: proposalsOfRequest.filter(
          (proposal) => proposal.status === ProposalStatus.ACCEPTED,
        ).length,
        pendingProposalCount: proposalsOfRequest.filter(
          (proposal) => proposal.status === ProposalStatus.PENDING,
        ).length,
      };
    });
  }

  /**
   * Detail d'une demande.
   *
   * Le formateur destinataire d'une proposition y a acces : il recevait
   * jusqu'ici `403` sur la demande qu'on lui demandait d'accepter.
   */
  async getRequest(id: string, context: RequestContext): Promise<TeacherRequestWithNames> {
    const { user } = context;
    const teacherRequest = await this.requestRepo.findOne({ where: { id } });
    if (!teacherRequest) throw new NotFoundException("Cette demande de professeur n'existe pas.");

    const isReadable = await this.canReadRequest(teacherRequest, context);
    if (!isReadable) throw new NotFoundException("Cette demande de professeur n'existe pas.");

    const [enriched] = await this.enrichRequestsWithNames([teacherRequest], context);
    if (user.role === UserRole.RESPONSABLE_PEDAGOGIQUE) {
      const [withCounts] = await this.attachProposalCounts([enriched]);
      return withCounts;
    }
    return enriched;
  }

  private async canReadRequest(teacherRequest: TeacherRequest, context: RequestContext): Promise<boolean> {
    const { user } = context;
    if (this.isAdministratorRole(user.role)) return true;
    if (user.role === UserRole.ELEVE) return teacherRequest.studentId === user.id;
    if (user.role === UserRole.FORMATEUR) {
      const proposalForTeacher = await this.proposalRepo.findOne({
        where: { requestId: teacherRequest.id, teacherId: user.id },
      });
      return proposalForTeacher !== null;
    }
    if (user.role === UserRole.PARENT_FINANCEUR) {
      if (teacherRequest.requesterId !== user.id) return false;
      const relationLookup = await this.profileServiceClient.getRelations(
        user.id,
        teacherRequest.studentId,
        user.role,
        this.toOutboundContext(context),
      );
      return relationLookup.relations.some((relation) => relation.kind === FINANCE_OWNER_OF_STUDENT);
    }
    return false;
  }

  // ── Etape 3 : le RP envoie une proposition aux formateurs ──────────────────

  async createProposals(
    requestId: string,
    dto: CreateProposalDto,
    context: RequestContext,
  ): Promise<TeacherProposalWithTeacherName[]> {
    const { user } = context;
    if (user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un responsable pedagogique peut transmettre une demande a des formateurs.');
    }
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Cette demande de professeur n'existe pas.");
    if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
      throw new BadRequestException('Cette demande est cloturee : elle ne peut plus etre transmise.');
    }

    const existingProposals = await this.proposalRepo.find({ where: { requestId } });
    const teachersAlreadySolicited = existingProposals
      .filter((proposal) =>
        [ProposalStatus.PENDING, ProposalStatus.ACCEPTED].includes(proposal.status),
      )
      .map((proposal) => proposal.teacherId);
    const duplicatedTeacherIds = dto.teacherIds.filter((teacherId) =>
      teachersAlreadySolicited.includes(teacherId),
    );
    if (duplicatedTeacherIds.length > 0) {
      throw new BadRequestException(
        `Une proposition est deja en cours aupres de ${duplicatedTeacherIds.length} formateur(s) de cette liste.`,
      );
    }

    const savedProposals = await this.dataSource.transaction(async (manager) => {
      const proposalRepository = manager.getRepository(TeacherProposal);
      const requestRepository = manager.getRepository(TeacherRequest);

      const createdProposals = await proposalRepository.save(
        dto.teacherIds.map((teacherId) =>
          proposalRepository.create({
            requestId,
            teacherId,
            message: dto.message,
            availabilityNote: dto.availabilityNote,
            compensationNote: dto.compensationNote,
            responseDeadline: dto.responseDeadline ?? null,
            status: ProposalStatus.PENDING,
          }),
        ),
      );
      await requestRepository.save({ ...request, status: RequestStatus.REDIRECTED });

      for (const createdProposal of createdProposals) {
        await this.events.record(
          {
            eventName: TeacherRequestEvent.PROPOSAL_SENT,
            aggregateType: 'TeacherProposal',
            aggregateId: createdProposal.id,
            payload: {
              proposalId: createdProposal.id,
              requestId,
              teacherId: createdProposal.teacherId,
              studentId: request.studentId,
              sentBy: user.id,
              responseDeadline: createdProposal.responseDeadline,
            },
            correlationId: context.correlationId,
          },
          manager,
        );
      }
      return createdProposals;
    });
    this.events.requestPublication();

    return this.enrichProposalsWithTeacherNames(savedProposals, context);
  }

  private async enrichProposalsWithTeacherNames(
    proposals: TeacherProposal[],
    context: RequestContext,
  ): Promise<TeacherProposalWithTeacherName[]> {
    const namesById = await this.resolveDisplayNames(
      proposals.map((proposal) => proposal.teacherId),
      this.toOutboundContext(context),
    );
    return proposals.map((proposal) => ({
      ...proposal,
      teacherName: namesById.get(proposal.teacherId) ?? null,
    }));
  }

  /**
   * Etape 5 : le RP lit les reponses avant de trancher.
   *
   * Cette lecture n'existait pas — `GET /requests/:id/proposals` repondait
   * `404` —, ce qui rendait l'arbitrage du RP impossible a rendre.
   */
  async listProposalsOfRequest(
    requestId: string,
    context: RequestContext,
  ): Promise<TeacherProposalWithTeacherName[]> {
    if (context.user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un responsable pedagogique peut consulter les reponses des formateurs.');
    }
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Cette demande de professeur n'existe pas.");

    const proposals = await this.proposalRepo.find({
      where: { requestId },
      order: { createdAt: 'ASC' },
    });
    return this.enrichProposalsWithTeacherNames(proposals, context);
  }

  // ── Etape 4 : le formateur repond ──────────────────────────────────────────

  /** Boite de reception du formateur, avec ce qu'on lui demande. */
  async listProposalsForTeacher(
    context: RequestContext,
    scope: RequestScope = RequestScope.OPEN,
  ): Promise<TeacherProposalWithRequest[]> {
    const proposals = await this.proposalRepo.find({
      where: { teacherId: context.user.id },
      order: { createdAt: 'DESC' },
    });
    if (proposals.length === 0) return [];

    const requests = await this.requestRepo.find({
      where: { id: In([...new Set(proposals.map((proposal) => proposal.requestId))]) },
    });
    const requestsById = new Map(requests.map((request) => [request.id, request]));

    const visibleProposals = proposals.filter((proposal) => {
      const request = requestsById.get(proposal.requestId);
      if (!request) return false;
      const isRequestOpen = !TERMINAL_REQUEST_STATUSES.includes(request.status);
      if (scope === RequestScope.ALL) return true;
      return scope === RequestScope.OPEN ? isRequestOpen : !isRequestOpen;
    });

    const namesById = await this.resolveDisplayNames(
      visibleProposals.map((proposal) => requestsById.get(proposal.requestId)!.studentId),
      this.toOutboundContext(context),
    );

    return visibleProposals.map((proposal) => {
      const request = requestsById.get(proposal.requestId)!;
      return {
        ...proposal,
        requestDescription: request.description ?? null,
        requestStatus: request.status,
        requestCreatedAt: request.createdAt,
        studentName: namesById.get(request.studentId) ?? null,
      };
    });
  }

  /**
   * L'acceptation enregistre une CANDIDATURE, jamais une affectation.
   *
   * C'etait le defaut central du service : deux formateurs acceptaient, deux
   * affectations `active` naissaient sur le meme eleve, et le RP n'arbitrait
   * rien. L'affectation nait desormais de la seule validation du RP.
   */
  async acceptProposal(proposalId: string, context: RequestContext): Promise<TeacherProposalWithRequest> {
    return this.respondToProposal(proposalId, ProposalStatus.ACCEPTED, context);
  }

  async declineProposal(proposalId: string, context: RequestContext): Promise<TeacherProposalWithRequest> {
    return this.respondToProposal(proposalId, ProposalStatus.DECLINED, context);
  }

  private async respondToProposal(
    proposalId: string,
    newStatus: ProposalStatus.ACCEPTED | ProposalStatus.DECLINED,
    context: RequestContext,
  ): Promise<TeacherProposalWithRequest> {
    const { user } = context;
    if (user.role !== UserRole.FORMATEUR) {
      throw new ForbiddenException('Seul un formateur peut repondre a une proposition.');
    }
    const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException("Cette proposition n'existe pas.");
    // Ne pas reveler l'existence d'une proposition adressee a un autre.
    if (proposal.teacherId !== user.id) throw new NotFoundException("Cette proposition n'existe pas.");
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException('Vous avez deja repondu a cette proposition.');
    }

    const request = await this.requestRepo.findOne({ where: { id: proposal.requestId } });
    if (!request) throw new NotFoundException("La demande liee a cette proposition n'existe plus.");
    if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
      throw new BadRequestException('Cette demande a ete cloturee : elle n\'attend plus de reponse.');
    }

    const updatedProposal = await this.dataSource.transaction(async (manager) => {
      const proposalRepository = manager.getRepository(TeacherProposal);
      const saved = await proposalRepository.save({
        ...proposal,
        status: newStatus,
        respondedAt: new Date(),
      });
      await this.events.record(
        {
          eventName:
            newStatus === ProposalStatus.ACCEPTED
              ? TeacherRequestEvent.PROPOSAL_ACCEPTED
              : TeacherRequestEvent.PROPOSAL_DECLINED,
          aggregateType: 'TeacherProposal',
          aggregateId: proposal.id,
          payload: {
            proposalId: proposal.id,
            requestId: proposal.requestId,
            teacherId: user.id,
            studentId: request.studentId,
          },
          correlationId: context.correlationId,
        },
        manager,
      );
      return saved;
    });
    this.events.requestPublication();

    const studentName = await this.profileServiceClient.resolveDisplayName(
      request.studentId,
      this.toOutboundContext(context),
    );
    return {
      ...updatedProposal,
      requestDescription: request.description ?? null,
      requestStatus: request.status,
      requestCreatedAt: request.createdAt,
      studentName,
    };
  }

  // ── Etapes 5 et 6 : le RP valide, le lien est cree ─────────────────────────

  /**
   * Point de decision unique du flow.
   *
   * Ordre volontaire : le lien est demande a profile-service AVANT la cloture
   * locale. Si l'appel echoue, rien n'est cloture et le RP peut recommencer ;
   * si la cloture echoue apres coup, le rejeu redemande le meme lien et
   * profile-service repond `200` (route rejouable depuis le 2026-08-12).
   * Cloturer d'abord aurait produit une demande « traitee » sans aucun lien —
   * une erreur metier transformee en succes technique.
   *
   * Un `409` de profile-service n'est PAS un rejeu : il signale un lien
   * existant contradictoire. Il remonte au RP tel quel, la demande reste
   * ouverte.
   */
  async validateCandidate(
    requestId: string,
    dto: ValidateCandidateDto,
    context: RequestContext,
  ): Promise<TeacherRequestWithNames> {
    const { user } = context;
    if (user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un responsable pedagogique peut retenir un formateur.');
    }
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Cette demande de professeur n'existe pas.");
    if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
      throw new BadRequestException('Cette demande est deja cloturee.');
    }

    const chosenProposal = await this.proposalRepo.findOne({ where: { id: dto.proposalId } });
    if (!chosenProposal) throw new NotFoundException("Cette proposition n'existe pas.");
    if (chosenProposal.requestId !== requestId) {
      throw new BadRequestException("Cette proposition ne concerne pas cette demande.");
    }
    if (chosenProposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException("Ce formateur n'a pas accepte la proposition.");
    }

    const isPrincipalTeacher = dto.isPrincipalTeacher ?? false;
    await this.profileServiceClient.createTeacherStudentRelation(
      { teacherId: chosenProposal.teacherId, studentId: request.studentId, isPrincipalTeacher },
      this.toOutboundContext(context),
    );

    const otherProposals = await this.proposalRepo.find({ where: { requestId } });

    const closedRequest = await this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(TeacherRequest);
      const proposalRepository = manager.getRepository(TeacherProposal);

      for (const proposal of otherProposals) {
        if (proposal.id === chosenProposal.id) continue;
        // Ni « refusee » (le formateur n'a rien refuse), ni laissee en
        // `accepted`/`pending` indefiniment : deux etats crees pour dire la
        // verite au formateur.
        if (proposal.status === ProposalStatus.ACCEPTED) {
          await proposalRepository.save({ ...proposal, status: ProposalStatus.NOT_SELECTED });
          await this.events.record(
            {
              eventName: TeacherRequestEvent.PROPOSAL_NOT_SELECTED,
              aggregateType: 'TeacherProposal',
              aggregateId: proposal.id,
              payload: { proposalId: proposal.id, requestId, teacherId: proposal.teacherId },
              correlationId: context.correlationId,
            },
            manager,
          );
        } else if (proposal.status === ProposalStatus.PENDING) {
          await proposalRepository.save({ ...proposal, status: ProposalStatus.EXPIRED });
          await this.events.record(
            {
              eventName: TeacherRequestEvent.PROPOSAL_EXPIRED,
              aggregateType: 'TeacherProposal',
              aggregateId: proposal.id,
              payload: { proposalId: proposal.id, requestId, teacherId: proposal.teacherId },
              correlationId: context.correlationId,
            },
            manager,
          );
        }
      }

      const saved = await requestRepository.save({
        ...request,
        status: RequestStatus.CLOSED,
        chosenTeacherId: chosenProposal.teacherId,
        closedAt: new Date(),
      });

      await this.events.record(
        {
          eventName: TeacherRequestEvent.TEACHER_ASSIGNED,
          aggregateType: 'TeacherRequest',
          aggregateId: requestId,
          payload: {
            requestId,
            proposalId: chosenProposal.id,
            studentId: request.studentId,
            teacherId: chosenProposal.teacherId,
            isPrincipalTeacher,
            validatedBy: user.id,
          },
          correlationId: context.correlationId,
        },
        manager,
      );
      await this.events.record(
        {
          eventName: TeacherRequestEvent.REQUEST_CLOSED,
          aggregateType: 'TeacherRequest',
          aggregateId: requestId,
          payload: { requestId, studentId: request.studentId, closedBy: user.id, reason: 'teacher_assigned' },
          correlationId: context.correlationId,
        },
        manager,
      );
      return saved;
    });
    this.events.requestPublication();

    const [enriched] = await this.enrichRequestsWithNames([closedRequest], context);
    return enriched;
  }

  // ── Cloture manuelle ───────────────────────────────────────────────────────

  async updateRequestStatus(
    id: string,
    newStatus: ManualRequestStatus,
    context: RequestContext,
  ): Promise<TeacherRequestWithNames> {
    const { user } = context;
    if (user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException("Seul un responsable pedagogique peut changer l'etat d'une demande.");
    }
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException("Cette demande de professeur n'existe pas.");
    if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
      throw new BadRequestException('Cette demande est deja cloturee.');
    }
    // `closed` ne se pose a la main que sur les demandes bloquees par l'ancien
    // modele : ailleurs, une demande se cloture en validant un candidat.
    if (newStatus === ManualRequestStatus.CLOSED && request.status !== RequestStatus.ASSIGNED) {
      throw new BadRequestException(
        'Une demande se cloture en retenant un formateur ; utilisez « declined » ou « cancelled » pour y renoncer.',
      );
    }

    const targetStatus = newStatus as unknown as RequestStatus;
    const proposals = await this.proposalRepo.find({ where: { requestId: id } });

    const updatedRequest = await this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(TeacherRequest);
      const proposalRepository = manager.getRepository(TeacherProposal);

      for (const proposal of proposals) {
        if (proposal.status !== ProposalStatus.PENDING && proposal.status !== ProposalStatus.ACCEPTED) continue;
        const terminalStatus =
          proposal.status === ProposalStatus.ACCEPTED ? ProposalStatus.NOT_SELECTED : ProposalStatus.EXPIRED;
        await proposalRepository.save({ ...proposal, status: terminalStatus });
        await this.events.record(
          {
            eventName:
              terminalStatus === ProposalStatus.NOT_SELECTED
                ? TeacherRequestEvent.PROPOSAL_NOT_SELECTED
                : TeacherRequestEvent.PROPOSAL_EXPIRED,
            aggregateType: 'TeacherProposal',
            aggregateId: proposal.id,
            payload: { proposalId: proposal.id, requestId: id, teacherId: proposal.teacherId },
            correlationId: context.correlationId,
          },
          manager,
        );
      }

      const saved = await requestRepository.save({
        ...request,
        status: targetStatus,
        closedAt: new Date(),
      });
      await this.events.record(
        {
          eventName: TeacherRequestEvent.REQUEST_STATUS_UPDATED,
          aggregateType: 'TeacherRequest',
          aggregateId: id,
          payload: { requestId: id, status: targetStatus, updatedBy: user.id },
          correlationId: context.correlationId,
        },
        manager,
      );
      return saved;
    });
    this.events.requestPublication();

    const [enriched] = await this.enrichRequestsWithNames([updatedRequest], context);
    return enriched;
  }

  async deleteRequest(id: string, context: RequestContext): Promise<void> {
    if (context.user.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un responsable pedagogique peut supprimer une demande.');
    }
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException("Cette demande de professeur n'existe pas.");

    await this.requestRepo.remove(request);
    await this.events.record({
      eventName: TeacherRequestEvent.REQUEST_DELETED,
      aggregateType: 'TeacherRequest',
      aggregateId: id,
      payload: { requestId: id, deletedBy: context.user.id },
      correlationId: context.correlationId,
    });
    this.events.requestPublication();
  }

  // ── Heritage : affectations creees par l'ancien modele ─────────────────────

  /**
   * Ces trois methodes travaillent sur la table `assignments`, que le flow
   * n'alimente PLUS : le lien eleve↔formateur appartient a profile-service.
   * Elles restent en service pour les affectations existantes, en attendant que
   * l'arret de collaboration soit reconstruit sur les relations.
   */
  async setMainTeacher(assignmentId: string, context: RequestContext): Promise<Assignment> {
    const { user } = context;
    if (![UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ELEVE].includes(user.role as UserRole)) {
      throw new ForbiddenException('Seuls un responsable pedagogique ou l\'eleve peuvent designer un professeur principal.');
    }
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("Cette affectation n'existe pas.");
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException("Cette affectation n'est plus active.");
    }
    if (user.role === UserRole.ELEVE && assignment.studentId !== user.id) {
      throw new NotFoundException("Cette affectation n'existe pas.");
    }
    const updated = await this.assignmentRepo.save({ ...assignment, isMainTeacher: true });
    await this.events.record({
      eventName: TeacherRequestEvent.MAIN_TEACHER_ASSIGNED,
      aggregateType: 'Assignment',
      aggregateId: assignmentId,
      payload: { assignmentId, studentId: assignment.studentId, teacherId: assignment.teacherId },
      correlationId: context.correlationId,
    });
    this.events.requestPublication();
    return updated;
  }

  async createTermination(
    assignmentId: string,
    dto: CreateTerminationDto,
    context: RequestContext,
  ): Promise<TerminationRequest> {
    const { user } = context;
    if (user.role !== UserRole.FORMATEUR) {
      throw new ForbiddenException('Seul un formateur peut demander l\'arret d\'une collaboration.');
    }
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("Cette affectation n'existe pas.");
    if (assignment.teacherId !== user.id) throw new NotFoundException("Cette affectation n'existe pas.");
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException("Cette affectation n'est plus active.");
    }

    const savedTermination = await this.dataSource.transaction(async (manager) => {
      const terminationRepository = manager.getRepository(TerminationRequest);
      const assignmentRepository = manager.getRepository(Assignment);

      const createdTermination = await terminationRepository.save(
        terminationRepository.create({
          assignmentId,
          teacherId: user.id,
          noticeDate: new Date(dto.noticeDate),
          reason: dto.reason,
        }),
      );
      await assignmentRepository.save({ ...assignment, status: AssignmentStatus.TERMINATION_REQUESTED });
      await this.events.record(
        {
          eventName: TeacherRequestEvent.STOP_REQUESTED,
          aggregateType: 'Assignment',
          aggregateId: assignmentId,
          payload: {
            terminationId: createdTermination.id,
            assignmentId,
            teacherId: user.id,
            studentId: assignment.studentId,
            noticeDate: dto.noticeDate,
          },
          correlationId: context.correlationId,
        },
        manager,
      );
      return createdTermination;
    });
    this.events.requestPublication();
    return savedTermination;
  }

  /** Doublon historique de `createTermination`, conserve le temps que la gateway et le front convergent. */
  async createCollaborationStopRequest(
    assignmentId: string,
    dto: CreateTerminationDto,
    context: RequestContext,
  ): Promise<TerminationRequest> {
    return this.createTermination(assignmentId, dto, context);
  }
}

import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ParentLinkRequest,
  ParentLinkRequestDirection,
  ParentLinkRequestStatus,
} from './entities/parent-link-request.entity';
import { CreateParentLinkRequestDto } from './dto/create-parent-link-request.dto';
import { CreateStudentInitiatedLinkRequestDto } from './dto/create-student-initiated-link-request.dto';
import { ProfilesService } from '../profiles/profiles.service';
import { RelationsService } from '../relations/relations.service';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../profiles/profiles.service';

@Injectable()
export class ParentLinkRequestsService {
  private readonly logger = new Logger(ParentLinkRequestsService.name);

  constructor(
    @InjectRepository(ParentLinkRequest)
    private readonly requestRepo: Repository<ParentLinkRequest>,
    private readonly profilesService: ProfilesService,
    private readonly relationsService: RelationsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Soumet une demande de rattachement parent↔élève.
   * Réservé au rôle PARENT_FINANCEUR.
   * Résout le loginIdentifier en UUID via identity-access-service (interne).
   * Retourne 404 si l'identifiant élève est introuvable.
   * Retourne 400 si l'identifiant ne correspond pas à un compte élève.
   * Retourne 409 si une demande en attente existe déjà pour cette paire parent–élève.
   */
  async createRequest(dto: CreateParentLinkRequestDto, actor: Actor): Promise<ParentLinkRequest> {
    if (actor.role !== UserRole.PARENT_FINANCEUR) {
      throw new ForbiddenException('Seul un parent_financeur peut soumettre une demande de rattachement');
    }

    const resolvedStudentId = await this.resolveStudentIdFromLoginIdentifier(dto.studentLoginIdentifier);

    const hasStudentProfile = await this.profilesService.studentPedagogicalProfileExists(resolvedStudentId);
    if (!hasStudentProfile) {
      throw new BadRequestException('Aucun profil élève trouvé pour cet identifiant.');
    }

    const pendingRequest = await this.requestRepo.findOne({
      where: {
        parentId: actor.id,
        studentId: resolvedStudentId,
        status: ParentLinkRequestStatus.PENDING,
      },
    });
    if (pendingRequest) {
      throw new ConflictException(
        'Une demande de rattachement en attente existe déjà pour cette paire parent–élève',
      );
    }

    const newRequest = this.requestRepo.create({
      parentId: actor.id,
      studentId: resolvedStudentId,
      status: ParentLinkRequestStatus.PENDING,
      direction: ParentLinkRequestDirection.PARENT_INITIATED,
    });
    const savedRequest = await this.requestRepo.save(newRequest);

    await this.notifyUser(
      resolvedStudentId,
      'Un parent demande à être rattaché à votre compte. Vérifiez vos demandes de rattachement.',
    );

    return savedRequest;
  }

  /**
   * Soumet une demande de rattachement initiée par un élève vers son parent.
   * Réservé au rôle ELEVE.
   * Résout le parentLoginIdentifier en UUID via identity-access-service (interne).
   * Retourne 404 si l'identifiant parent est introuvable.
   * Retourne 400 si l'identifiant ne correspond pas à un compte parent_financeur.
   * Retourne 409 si une demande en attente existe déjà pour cette paire élève–parent.
   * Déclenche une notification best-effort au parent.
   */
  async createStudentInitiatedRequest(
    dto: CreateStudentInitiatedLinkRequestDto,
    actor: Actor,
  ): Promise<ParentLinkRequest> {
    if (actor.role !== UserRole.ELEVE) {
      throw new ForbiddenException('Seul un élève peut initier une demande de rattachement vers un parent');
    }

    const resolvedParentId = await this.resolveParentIdFromLoginIdentifier(dto.parentLoginIdentifier);

    const pendingRequest = await this.requestRepo.findOne({
      where: {
        parentId: resolvedParentId,
        studentId: actor.id,
        status: ParentLinkRequestStatus.PENDING,
      },
    });
    if (pendingRequest) {
      throw new ConflictException(
        'Une demande de rattachement en attente existe déjà pour cette paire élève–parent',
      );
    }

    const newRequest = this.requestRepo.create({
      parentId: resolvedParentId,
      studentId: actor.id,
      status: ParentLinkRequestStatus.PENDING,
      direction: ParentLinkRequestDirection.STUDENT_INITIATED,
    });
    const savedRequest = await this.requestRepo.save(newRequest);

    await this.notifyUser(
      resolvedParentId,
      'Un élève vous invite à être rattaché à son compte. Vérifiez vos demandes de rattachement.',
    );

    return savedRequest;
  }

  /**
   * List parent-link requests filtered by role:
   * - PARENT_FINANCEUR: leurs propres demandes (parent_initiated) + demandes student_initiated où ils sont parentId
   * - ELEVE: demandes les ciblant (parent_initiated où ils sont studentId) + leurs propres demandes student_initiated
   * - RP or TI: all requests
   */
  async listRequests(actor: Actor): Promise<ParentLinkRequest[]> {
    if (actor.role === UserRole.PARENT_FINANCEUR) {
      // Parent sees all requests where they appear as parentId (both directions)
      return this.requestRepo.find({
        where: { parentId: actor.id },
        order: { requestedAt: 'DESC' },
      });
    }

    if (actor.role === UserRole.ELEVE) {
      // Student sees all requests where they appear as studentId (both directions)
      return this.requestRepo.find({
        where: { studentId: actor.id },
        order: { requestedAt: 'DESC' },
      });
    }

    const privilegedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (privilegedRoles.includes(actor.role)) {
      return this.requestRepo.find({ order: { requestedAt: 'DESC' } });
    }

    throw new ForbiddenException(
      'Only parent_financeur, eleve, responsable_pedagogique, or technicien_informatique may list parent-link requests',
    );
  }

  /**
   * Approve a parent-link request.
   * Allowed for the targeted élève, RP, or TI.
   * On approval, creates the finance-owner–student link using existing logic.
   */
  async approveRequest(requestId: string, actor: Actor): Promise<ParentLinkRequest> {
    const linkRequest = await this.findRequestOrFail(requestId);

    this.assertCanProcessRequest(linkRequest, actor);

    if (linkRequest.status !== ParentLinkRequestStatus.PENDING) {
      throw new ConflictException('Only a pending request can be approved');
    }

    // Create the actual finance-owner–student link if it does not already exist
    await this.relationsService.ensureFinanceOwnerStudentLink(
      linkRequest.parentId,
      linkRequest.studentId,
    );

    linkRequest.status = ParentLinkRequestStatus.APPROVED;
    linkRequest.processedAt = new Date();
    linkRequest.processedBy = actor.id;
    const savedRequest = await this.requestRepo.save(linkRequest);

    // Best-effort notification to the initiator (opposite side depending on direction)
    if (linkRequest.direction === ParentLinkRequestDirection.PARENT_INITIATED) {
      await this.notifyUser(
        linkRequest.parentId,
        'Votre demande de rattachement à un élève a été approuvée.',
      );
    } else {
      await this.notifyUser(
        linkRequest.studentId,
        'Votre invitation de rattachement a été acceptée par le parent.',
      );
    }

    return savedRequest;
  }

  /**
   * Reject a parent-link request.
   * Allowed for the targeted élève, RP, or TI.
   */
  async rejectRequest(requestId: string, actor: Actor): Promise<ParentLinkRequest> {
    const linkRequest = await this.findRequestOrFail(requestId);

    this.assertCanProcessRequest(linkRequest, actor);

    if (linkRequest.status !== ParentLinkRequestStatus.PENDING) {
      throw new ConflictException('Only a pending request can be rejected');
    }

    linkRequest.status = ParentLinkRequestStatus.REJECTED;
    linkRequest.processedAt = new Date();
    linkRequest.processedBy = actor.id;
    const savedRequest = await this.requestRepo.save(linkRequest);

    // Best-effort notification to the initiator (opposite side depending on direction)
    if (linkRequest.direction === ParentLinkRequestDirection.PARENT_INITIATED) {
      await this.notifyUser(
        linkRequest.parentId,
        'Votre demande de rattachement à un élève a été rejetée.',
      );
    } else {
      await this.notifyUser(
        linkRequest.studentId,
        'Votre invitation de rattachement a été refusée par le parent.',
      );
    }

    return savedRequest;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findRequestOrFail(requestId: string): Promise<ParentLinkRequest> {
    const linkRequest = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!linkRequest) {
      throw new NotFoundException(`Parent-link request ${requestId} not found`);
    }
    return linkRequest;
  }

  /**
   * Verifies that the actor has rights to approve or reject the given request.
   *
   * For parent_initiated requests:
   *   Only the targeted élève (matching studentId), RP, or TI may process requests.
   *
   * For student_initiated requests:
   *   Only the targeted parent (matching parentId), RP, or TI may process requests.
   */
  private assertCanProcessRequest(linkRequest: ParentLinkRequest, actor: Actor): void {
    const privilegedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];

    if (privilegedRoles.includes(actor.role)) return;

    if (linkRequest.direction === ParentLinkRequestDirection.PARENT_INITIATED) {
      if (actor.role === UserRole.ELEVE && actor.id === linkRequest.studentId) return;
      throw new ForbiddenException(
        'Seul l\'élève ciblé, un responsable_pedagogique ou un technicien_informatique peut traiter cette demande',
      );
    }

    if (linkRequest.direction === ParentLinkRequestDirection.STUDENT_INITIATED) {
      if (actor.role === UserRole.PARENT_FINANCEUR && actor.id === linkRequest.parentId) return;
      throw new ForbiddenException(
        'Seul le parent ciblé, un responsable_pedagogique ou un technicien_informatique peut traiter cette demande',
      );
    }

    throw new ForbiddenException('Direction de demande non reconnue');
  }

  /**
   * Résout un loginIdentifier parent_financeur en UUID via identity-access-service.
   * Lève NotFoundException si l'identifiant est introuvable (404 distant).
   * Lève BadRequestException si le compte trouvé n'est pas de rôle 'parent_financeur'.
   */
  private async resolveParentIdFromLoginIdentifier(parentLoginIdentifier: string): Promise<string> {
    const identityServiceUrl = this.configService.get<string>(
      'IDENTITY_ACCESS_SERVICE_URL',
      'http://identity-access-service:3001',
    );
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET', '');

    let response: Response;
    try {
      response = await fetch(
        `${identityServiceUrl}/internal/accounts/by-login-identifier?loginIdentifier=${encodeURIComponent(parentLoginIdentifier)}`,
        {
          method: 'GET',
          headers: { 'X-Internal-Secret': internalSecret },
        },
      );
    } catch (networkError) {
      this.logger.error(
        `Impossible de joindre identity-access-service pour résoudre le loginIdentifier parent : ${(networkError as Error).message}`,
      );
      throw new BadRequestException('Service d\'identité temporairement indisponible, veuillez réessayer.');
    }

    if (response.status === 404) {
      throw new NotFoundException('Identifiant parent introuvable');
    }

    if (!response.ok) {
      this.logger.error(`identity-access-service a retourné HTTP ${response.status} pour loginIdentifier ${parentLoginIdentifier}`);
      throw new BadRequestException('Erreur lors de la résolution de l\'identifiant parent.');
    }

    const accountData = await response.json() as { userId: string; role: string };

    if (accountData.role !== 'parent_financeur') {
      throw new BadRequestException('Cet identifiant ne correspond pas à un compte parent_financeur');
    }

    return accountData.userId;
  }

  /**
   * Résout un loginIdentifier élève en UUID via identity-access-service.
   * Lève NotFoundException si l'identifiant est introuvable (404 distant).
   * Lève BadRequestException si le compte trouvé n'est pas de rôle 'eleve'.
   */
  private async resolveStudentIdFromLoginIdentifier(studentLoginIdentifier: string): Promise<string> {
    const identityServiceUrl = this.configService.get<string>(
      'IDENTITY_ACCESS_SERVICE_URL',
      'http://identity-access-service:3001',
    );
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET', '');

    let response: Response;
    try {
      response = await fetch(
        `${identityServiceUrl}/internal/accounts/by-login-identifier?loginIdentifier=${encodeURIComponent(studentLoginIdentifier)}`,
        {
          method: 'GET',
          headers: { 'X-Internal-Secret': internalSecret },
        },
      );
    } catch (networkError) {
      this.logger.error(
        `Impossible de joindre identity-access-service pour résoudre le loginIdentifier : ${(networkError as Error).message}`,
      );
      throw new BadRequestException('Service d\'identité temporairement indisponible, veuillez réessayer.');
    }

    if (response.status === 404) {
      throw new NotFoundException('Identifiant élève introuvable');
    }

    if (!response.ok) {
      this.logger.error(`identity-access-service a retourné HTTP ${response.status} pour loginIdentifier ${studentLoginIdentifier}`);
      throw new BadRequestException('Erreur lors de la résolution de l\'identifiant élève.');
    }

    const accountData = await response.json() as { userId: string; role: string };

    if (accountData.role !== 'eleve') {
      throw new BadRequestException('Cet identifiant ne correspond pas à un compte élève');
    }

    return accountData.userId;
  }

  /**
   * Best-effort HTTP notification to dashboard-notification-service using native fetch.
   * Logs and continues on failure — never throws.
   */
  private async notifyUser(userId: string, message: string): Promise<void> {
    const dashboardServiceUrl = this.configService.get<string>('DASHBOARD_NOTIFICATION_SERVICE_URL');
    if (!dashboardServiceUrl) {
      this.logger.warn('DASHBOARD_NOTIFICATION_SERVICE_URL not set — skipping notification');
      return;
    }

    try {
      await fetch(`${dashboardServiceUrl}/internal/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message }),
      });
    } catch (notificationError) {
      this.logger.warn(
        `Failed to notify user ${userId} via dashboard-notification-service: ${(notificationError as Error).message}`,
      );
    }
  }
}

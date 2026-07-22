import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ParentLinkRequest,
  ParentLinkRequestDirection,
  ParentLinkRequestStatus,
} from './entities/parent-link-request.entity';
import { CreateParentLinkRequestDto } from './dto/create-parent-link-request.dto';
import { CreateStudentInitiatedLinkRequestDto } from './dto/create-student-initiated-link-request.dto';
import { ProfilesService } from '../profiles/profiles.service';
import { RelationsService } from '../relations/relations.service';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../common/clients/identity-access.client';
import { DashboardNotificationClient } from '../common/clients/dashboard-notification.client';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../common/types/actor.type';

@Injectable()
export class ParentLinkRequestsService {
  constructor(
    @InjectRepository(ParentLinkRequest)
    private readonly requestRepo: Repository<ParentLinkRequest>,
    private readonly profilesService: ProfilesService,
    private readonly relationsService: RelationsService,
    private readonly identityAccessClient: IdentityAccessClient,
    private readonly dashboardNotificationClient: DashboardNotificationClient,
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
   * Résout un loginIdentifier parent_financeur en UUID via le client typé
   * IdentityAccessClient (services-convention : appels interservices via un
   * client typé avec timeout).
   * Lève NotFoundException si l'identifiant est introuvable (404 distant).
   * Lève BadRequestException si le compte trouvé n'est pas de rôle
   * 'parent_financeur' ou si identity-access-service est indisponible.
   */
  private async resolveParentIdFromLoginIdentifier(parentLoginIdentifier: string): Promise<string> {
    const account = await this.findAccountByLoginIdentifier(
      parentLoginIdentifier,
      'Identifiant parent introuvable',
      'Service d\'identité temporairement indisponible, veuillez réessayer.',
    );

    if (account.role !== 'parent_financeur') {
      throw new BadRequestException('Cet identifiant ne correspond pas à un compte parent_financeur');
    }

    return account.userId;
  }

  /**
   * Résout un loginIdentifier élève en UUID via le client typé
   * IdentityAccessClient.
   * Lève NotFoundException si l'identifiant est introuvable (404 distant).
   * Lève BadRequestException si le compte trouvé n'est pas de rôle 'eleve'
   * ou si identity-access-service est indisponible.
   */
  private async resolveStudentIdFromLoginIdentifier(studentLoginIdentifier: string): Promise<string> {
    const account = await this.findAccountByLoginIdentifier(
      studentLoginIdentifier,
      'Identifiant élève introuvable',
      'Service d\'identité temporairement indisponible, veuillez réessayer.',
    );

    if (account.role !== 'eleve') {
      throw new BadRequestException('Cet identifiant ne correspond pas à un compte élève');
    }

    return account.userId;
  }

  /**
   * Shared lookup + error-mapping helper: translates the client's typed
   * transport errors into this feature's own business exceptions
   * (NotFoundException / BadRequestException).
   */
  private async findAccountByLoginIdentifier(
    loginIdentifier: string,
    notFoundMessage: string,
    unavailableMessage: string,
  ): Promise<{ userId: string; role: string }> {
    try {
      return await this.identityAccessClient.findAccountByLoginIdentifier(loginIdentifier);
    } catch (error) {
      if (error instanceof IdentityAccessNotFoundError) {
        throw new NotFoundException(notFoundMessage);
      }
      if (error instanceof IdentityAccessUnavailableError) {
        throw new BadRequestException(unavailableMessage);
      }
      throw error;
    }
  }

  /**
   * Best-effort notification via the typed DashboardNotificationClient
   * adapter. Never throws.
   */
  private async notifyUser(userId: string, message: string): Promise<void> {
    await this.dashboardNotificationClient.notify(userId, message);
  }
}

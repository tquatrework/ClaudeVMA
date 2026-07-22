import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DelegatedAccessRequest, DelegationStatus } from './entities/delegated-access-request.entity';
import { UserRole } from '../auth/entities/user.entity';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { EventsService } from '../events/events.service';
import { AccountsService } from '../accounts/accounts.service';
import { Actor } from '../common/types/actor';

const DELEGATION_ALLOWED_ROLES: UserRole[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/** Nombre maximal d'enregistrements retournés par listDelegations (services-convention). */
const DEFAULT_LIST_LIMIT = 200;

@Injectable()
export class DelegationsService {
  constructor(
    @InjectRepository(DelegatedAccessRequest)
    private readonly delegationRepo: Repository<DelegatedAccessRequest>,
    private readonly eventsService: EventsService,
    private readonly accountsService: AccountsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Crée une demande de délégation et son entrée d'audit. Les deux écritures
   * (DelegatedAccessRequest propre + AuditLog délégué à AccountsService) sont
   * atomiques via DataSource.transaction ; l'événement métier n'est publié
   * qu'après le commit.
   */
  async createDelegation(dto: CreateDelegationDto, actor: Actor): Promise<DelegatedAccessRequest> {
    if (!DELEGATION_ALLOWED_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only RP or TI can create delegation requests');
    }

    const targetAccountExists = await this.accountsService.accountExists(dto.targetUserId);
    if (!targetAccountExists) {
      throw new NotFoundException(`Target account ${dto.targetUserId} not found`);
    }

    const delegation = await this.dataSource.transaction(async (manager) => {
      const delegationRepo = manager.getRepository(DelegatedAccessRequest);

      const savedDelegation = await delegationRepo.save(
        delegationRepo.create({
          actorId: actor.id,
          targetUserId: dto.targetUserId,
          actionDescription: dto.actionDescription,
          reason: dto.reason,
          status: DelegationStatus.PENDING,
        }),
      );

      await this.accountsService.recordAudit(
        {
          targetUserId: dto.targetUserId,
          actorId: actor.id,
          action: 'DELEGATION_CREATED',
          oldValue: null,
          newValue: {
            delegationId: savedDelegation.id,
            actionDescription: dto.actionDescription,
            reason: dto.reason,
          },
        },
        manager,
      );

      return savedDelegation;
    });

    this.eventsService.publish('DelegatedAccessGranted', {
      delegationId: delegation.id,
      actorId: actor.id,
      targetUserId: dto.targetUserId,
    });

    return delegation;
  }

  async listDelegations(actor: Actor): Promise<DelegatedAccessRequest[]> {
    if (!DELEGATION_ALLOWED_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only RP or TI can list delegation requests');
    }
    return this.delegationRepo.find({
      where: { actorId: actor.id },
      order: { createdAt: 'DESC' },
      take: DEFAULT_LIST_LIMIT,
    });
  }
}

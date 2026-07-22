import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class DelegationsService {
  constructor(
    @InjectRepository(DelegatedAccessRequest)
    private readonly delegationRepo: Repository<DelegatedAccessRequest>,
    private readonly eventsService: EventsService,
    private readonly accountsService: AccountsService,
  ) {}

  async createDelegation(dto: CreateDelegationDto, actor: Actor): Promise<DelegatedAccessRequest> {
    if (!DELEGATION_ALLOWED_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only RP or TI can create delegation requests');
    }

    const targetAccountExists = await this.accountsService.accountExists(dto.targetUserId);
    if (!targetAccountExists) {
      throw new NotFoundException(`Target account ${dto.targetUserId} not found`);
    }

    const delegation = await this.delegationRepo.save(
      this.delegationRepo.create({
        actorId: actor.id,
        targetUserId: dto.targetUserId,
        actionDescription: dto.actionDescription,
        reason: dto.reason,
        status: DelegationStatus.PENDING,
      }),
    );

    await this.accountsService.recordAudit({
      targetUserId: dto.targetUserId,
      actorId: actor.id,
      action: 'DELEGATION_CREATED',
      oldValue: null,
      newValue: {
        delegationId: delegation.id,
        actionDescription: dto.actionDescription,
        reason: dto.reason,
      },
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
    });
  }
}

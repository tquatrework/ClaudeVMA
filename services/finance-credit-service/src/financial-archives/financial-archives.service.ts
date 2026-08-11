import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialArchiveItem } from './entities/financial-archive-item.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class FinancialArchivesService {
  constructor(
    @InjectRepository(FinancialArchiveItem)
    private readonly archiveRepo: Repository<FinancialArchiveItem>,
  ) {}

  /**
   * List all financial archive items for a given owner.
   * Accessible by the owner — whatever their role — and by AF, RP, TI on a third party.
   * FIN-FB-002: archives are filterable and show the running balance.
   */
  async findAllByOwner(
    ownerId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<FinancialArchiveItem[]> {
    this.assertCanRead(ownerId, requesterId, requesterRole);

    return this.archiveRepo.find({
      where: { ownerId },
      order: { occurredAt: 'DESC' },
    });
  }

  // ---- Private helpers ----

  /**
   * Read rule, in two clearly separated cases:
   *  1. own archives — allowed to every role, no allowlist involved (a formateur or an
   *     animateur_pedagogique has financial archives of their own);
   *  2. someone else's archives — reserved to the privileged roles below. Unchanged.
   */
  private assertCanRead(ownerId: string, requesterId: string, requesterRole: string): void {
    // Case 1: the owner, whatever their role.
    if (requesterId === ownerId) return;

    // Case 2: privileged roles reading a third party.
    const privilegedRoles: string[] = [
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (privilegedRoles.includes(requesterRole)) return;

    throw new ForbiddenException('Access to this financial archive is not allowed');
  }
}

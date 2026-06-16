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
   * Accessible by the owner, AF, RP, and TI.
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

  private assertCanRead(ownerId: string, requesterId: string, requesterRole: string): void {
    const privilegedRoles: string[] = [
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (requesterId === ownerId) return;
    if (privilegedRoles.includes(requesterRole)) return;
    throw new ForbiddenException('Access to this financial archive is not allowed');
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialProfile, FinancialProfileType } from './entities/financial-profile.entity';
import { UpdateFinancialProfileDto } from './dto/update-financial-profile.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class FinancialProfilesService {
  constructor(
    @InjectRepository(FinancialProfile)
    private readonly profileRepo: Repository<FinancialProfile>,
  ) {}

  /**
   * Retrieve a financial profile by owner ID.
   * FIN-FB-001: readable by the owner — whatever their role — or by AF, RP, TI.
   *
   * The permission check runs BEFORE the existence check on purpose, so that the two
   * answers stay unambiguous and non-leaking:
   *  - 403 = "not allowed", and says nothing about whether a profile exists;
   *  - 404 = "no profile yet", only ever returned to someone entitled to know.
   * The client relies on that distinction: a 404 on one's own id means "profile to be
   * created", not "access denied".
   */
  async findByOwnerId(
    ownerId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<FinancialProfile> {
    this.assertCanRead(ownerId, requesterId, requesterRole);

    const profile = await this.profileRepo.findOne({ where: { ownerId } });
    if (!profile) {
      throw new NotFoundException(`Financial profile for owner ${ownerId} not found`);
    }
    return profile;
  }

  /**
   * Update payment method or funding parameters.
   * Only the owner or privileged roles (AF, TI) can update.
   */
  async update(
    ownerId: string,
    dto: UpdateFinancialProfileDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<FinancialProfile> {
    const profile = await this.profileRepo.findOne({ where: { ownerId } });
    if (!profile) {
      throw new NotFoundException(`Financial profile for owner ${ownerId} not found`);
    }
    this.assertCanWrite(ownerId, requesterId, requesterRole);

    const updatedProfile = await this.profileRepo.save({
      ...profile,
      ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
      ...(dto.paymentReference !== undefined && { paymentReference: dto.paymentReference }),
      ...(dto.fundingEndDate !== undefined && { fundingEndDate: dto.fundingEndDate }),
    });

    return updatedProfile;
  }

  /**
   * Create a new financial profile (called internally after a confirmed inscription payment).
   */
  async createOrUpgradeToMembre(
    ownerId: string,
    correlationId?: string,
  ): Promise<FinancialProfile> {
    const existingProfile = await this.profileRepo.findOne({ where: { ownerId } });

    if (existingProfile) {
      return this.profileRepo.save({
        ...existingProfile,
        profileType: FinancialProfileType.MEMBRE,
        correlationId: correlationId ?? existingProfile.correlationId,
      });
    }

    return this.profileRepo.save(
      this.profileRepo.create({
        ownerId,
        profileType: FinancialProfileType.MEMBRE,
        pointsBalance: 0,
        correlationId: correlationId ?? null,
      }),
    );
  }

  /**
   * Update points balance after a ledger operation.
   */
  async updatePointsBalance(ownerId: string, newBalance: number): Promise<void> {
    const profile = await this.profileRepo.findOne({ where: { ownerId } });
    if (!profile) {
      throw new NotFoundException(`Financial profile for owner ${ownerId} not found`);
    }
    await this.profileRepo.save({ ...profile, pointsBalance: newBalance });
  }

  // ---- Private helpers ----

  /**
   * Read rule, in two clearly separated cases:
   *  1. own profile — allowed to every role, no allowlist involved. A formateur or an
   *     animateur_pedagogique is paid through this service and must see their own
   *     financial data, exactly like a parent_financeur;
   *  2. someone else's profile — reserved to the privileged roles below. Unchanged.
   */
  private assertCanRead(ownerId: string, requesterId: string, requesterRole: string): void {
    // Case 1: the owner, whatever their role.
    if (requesterId === ownerId) return;

    // Case 2: privileged roles reading a third party.
    const privilegedReadRoles: string[] = [
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (privilegedReadRoles.includes(requesterRole)) return;

    throw new ForbiddenException('Access to this financial profile is not allowed');
  }

  /**
   * Write rule — deliberately NOT aligned on the read rule.
   * Reading one's own profile is open to every role; writing it is additionally gated by
   * the `@Roles(...)` allowlist on the PATCH route (parent_financeur, AF, TI). Widening
   * the read side must not widen this one.
   */
  private assertCanWrite(ownerId: string, requesterId: string, requesterRole: string): void {
    const privilegedWriteRoles: string[] = [
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (requesterId === ownerId) return;
    if (privilegedWriteRoles.includes(requesterRole)) return;
    throw new ForbiddenException('Modification of this financial profile is not allowed');
  }
}

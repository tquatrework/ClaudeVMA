import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ContactPolicy, ContactVisibility } from './entities/contact-policy.entity';
import { SyncContactsDto } from './dto/sync-contacts.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

/** Defensive bound on unpaginated list endpoints (see services-convention). */
const DEFAULT_LIST_LIMIT = 200;

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactPolicy)
    private readonly contactPolicyRepository: Repository<ContactPolicy>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Initialize or update the authorized contact list for a user.
   * Called by the internal API (triggered by orchestration-service after profile relations are set).
   * COM-BR-010: contacts derive from profile-service business relations.
   * All entries are synced atomically: a failure on one entry rolls back the whole batch.
   */
  async syncContacts(dto: SyncContactsDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContactPolicy);

      for (const entry of dto.contacts) {
        const existing = await repository.findOne({
          where: { userId: dto.userId, contactId: entry.contactId },
        });

        if (existing) {
          existing.expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
          existing.relationType = entry.relationType ?? existing.relationType;
          existing.active = true;
          await repository.save(existing);
        } else {
          await repository.save(
            repository.create({
              userId: dto.userId,
              contactId: entry.contactId,
              expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
              relationType: entry.relationType,
              active: true,
            }),
          );
        }
      }
    });
  }

  /**
   * List all currently active contacts for the calling actor.
   * Expired contacts (expiresAt in the past) are excluded.
   */
  async listContacts(actor: AuthenticatedUser): Promise<ContactPolicy[]> {
    const now = new Date();
    const allContacts = await this.contactPolicyRepository.find({
      where: { userId: actor.id, active: true },
      order: { createdAt: 'ASC' },
      take: DEFAULT_LIST_LIMIT,
    });
    return allContacts.filter((contactPolicy) => !contactPolicy.expiresAt || contactPolicy.expiresAt > now);
  }

  /**
   * Check if user A is authorized to contact user B.
   * COM-FB-002: a user must not be able to create a conversation with an unauthorized contact.
   */
  async isAuthorized(userId: string, contactId: string): Promise<boolean> {
    const now = new Date();
    const contactPolicy = await this.contactPolicyRepository.findOne({
      where: { userId, contactId, active: true },
    });
    if (!contactPolicy) return false;
    if (contactPolicy.expiresAt && contactPolicy.expiresAt < now) return false;
    return true;
  }

  /**
   * Batch-check authorization for several potential contacts at once
   * (avoids one query per participant — N+1 — when creating a group conversation).
   * Returns the subset of contactIds that are NOT authorized for userId.
   * COM-FB-002.
   */
  async findUnauthorizedContacts(userId: string, contactIds: string[]): Promise<string[]> {
    if (contactIds.length === 0) return [];

    const now = new Date();
    const policies = await this.contactPolicyRepository.find({
      where: { userId, contactId: In(contactIds), active: true },
    });
    const authorizedIds = new Set(
      policies
        .filter((policy) => !policy.expiresAt || policy.expiresAt > now)
        .map((policy) => policy.contactId),
    );
    return contactIds.filter((contactId) => !authorizedIds.has(contactId));
  }

  /**
   * Activate a precontact for the given actor.
   * Transitions status from 'precontact' to 'active'.
   * Throws NotFoundException if the contact does not exist for this user.
   */
  async activateContact(actor: AuthenticatedUser, contactPolicyId: string): Promise<ContactPolicy> {
    const contactPolicy = await this.findOwnedContactOrThrow(actor.id, contactPolicyId);
    contactPolicy.status = 'active';
    contactPolicy.active = true;
    return this.contactPolicyRepository.save(contactPolicy);
  }

  /**
   * Remove a contact from the actor's list.
   * COM-BR-010: mandatory contacts (e.g. administrators, assigned teachers) cannot be removed.
   * Throws NotFoundException if the contact does not belong to this user.
   * Throws ForbiddenException if the contact is marked as mandatory.
   */
  async removeContact(actor: AuthenticatedUser, contactPolicyId: string): Promise<void> {
    const contactPolicy = await this.findOwnedContactOrThrow(actor.id, contactPolicyId);
    if (contactPolicy.mandatory) {
      throw new ForbiddenException('Mandatory contacts cannot be removed');
    }
    contactPolicy.active = false;
    await this.contactPolicyRepository.save(contactPolicy);
  }

  /**
   * Update the display visibility of a contact for the actor.
   * Allowed values: 'visible' | 'hidden'.
   * Throws NotFoundException if the contact does not belong to this user.
   */
  async updateVisibility(
    actor: AuthenticatedUser,
    contactPolicyId: string,
    visibility: ContactVisibility,
  ): Promise<ContactPolicy> {
    const contactPolicy = await this.findOwnedContactOrThrow(actor.id, contactPolicyId);
    contactPolicy.visibility = visibility;
    return this.contactPolicyRepository.save(contactPolicy);
  }

  /** Shared resource-ownership invariant: the contact must belong to the calling user. */
  private async findOwnedContactOrThrow(userId: string, contactPolicyId: string): Promise<ContactPolicy> {
    const contactPolicy = await this.contactPolicyRepository.findOne({
      where: { id: contactPolicyId, userId },
    });
    if (!contactPolicy) {
      throw new NotFoundException(`Contact ${contactPolicyId} not found for user ${userId}`);
    }
    return contactPolicy;
  }
}

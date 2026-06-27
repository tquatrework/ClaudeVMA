import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ContactPolicy, ContactVisibility } from './entities/contact-policy.entity';
import { SyncContactsDto } from './dto/sync-contacts.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactPolicy)
    private readonly contactPolicyRepository: Repository<ContactPolicy>,
  ) {}

  /**
   * Initialize or update the authorized contact list for a user.
   * Called by the internal API (triggered by orchestration-service after profile relations are set).
   * COM-BR-010: contacts derive from profile-service business relations.
   */
  async syncContacts(dto: SyncContactsDto): Promise<void> {
    for (const entry of dto.contacts) {
      const existing = await this.contactPolicyRepository.findOne({
        where: { userId: dto.userId, contactId: entry.contactId },
      });

      if (existing) {
        existing.expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
        existing.relationType = entry.relationType ?? existing.relationType;
        existing.active = true;
        await this.contactPolicyRepository.save(existing);
      } else {
        await this.contactPolicyRepository.save(
          this.contactPolicyRepository.create({
            userId: dto.userId,
            contactId: entry.contactId,
            expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
            relationType: entry.relationType,
            active: true,
          }),
        );
      }
    }
  }

  /**
   * List all currently active contacts for a user.
   * Expired contacts (expiresAt in the past) are excluded.
   */
  async listContacts(userId: string): Promise<ContactPolicy[]> {
    const now = new Date();
    const allContacts = await this.contactPolicyRepository.find({
      where: { userId, active: true },
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
   * Activate a precontact for the given user.
   * Transitions status from 'precontact' to 'active'.
   * Throws NotFoundException if the contact does not exist for this user.
   */
  async activateContact(userId: string, contactPolicyId: string): Promise<ContactPolicy> {
    const contactPolicy = await this.contactPolicyRepository.findOne({
      where: { id: contactPolicyId, userId },
    });
    if (!contactPolicy) {
      throw new NotFoundException(`Contact ${contactPolicyId} not found for user ${userId}`);
    }
    contactPolicy.status = 'active';
    contactPolicy.active = true;
    return this.contactPolicyRepository.save(contactPolicy);
  }

  /**
   * Remove a contact from the user's list.
   * COM-BR-010: mandatory contacts (e.g. administrators, assigned teachers) cannot be removed.
   * Throws NotFoundException if the contact does not belong to this user.
   * Throws ForbiddenException if the contact is marked as mandatory.
   */
  async removeContact(userId: string, contactPolicyId: string): Promise<void> {
    const contactPolicy = await this.contactPolicyRepository.findOne({
      where: { id: contactPolicyId, userId },
    });
    if (!contactPolicy) {
      throw new NotFoundException(`Contact ${contactPolicyId} not found for user ${userId}`);
    }
    if (contactPolicy.mandatory) {
      throw new ForbiddenException('Mandatory contacts cannot be removed');
    }
    contactPolicy.active = false;
    await this.contactPolicyRepository.save(contactPolicy);
  }

  /**
   * Update the display visibility of a contact for the current user.
   * Allowed values: 'visible' | 'hidden'.
   * Throws NotFoundException if the contact does not belong to this user.
   */
  async updateVisibility(
    userId: string,
    contactPolicyId: string,
    visibility: ContactVisibility,
  ): Promise<ContactPolicy> {
    const contactPolicy = await this.contactPolicyRepository.findOne({
      where: { id: contactPolicyId, userId },
    });
    if (!contactPolicy) {
      throw new NotFoundException(`Contact ${contactPolicyId} not found for user ${userId}`);
    }
    contactPolicy.visibility = visibility;
    return this.contactPolicyRepository.save(contactPolicy);
  }
}

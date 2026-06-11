import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ContactPolicy } from './entities/contact-policy.entity';
import { SyncContactsDto } from './dto/sync-contacts.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactPolicy)
    private readonly repo: Repository<ContactPolicy>,
  ) {}

  /**
   * Initialize or update the authorized contact list for a user.
   * Called by the internal API (triggered by orchestration-service after profile relations are set).
   * COM-BR-010: contacts derive from profile-service business relations.
   */
  async syncContacts(dto: SyncContactsDto): Promise<void> {
    for (const entry of dto.contacts) {
      const existing = await this.repo.findOne({
        where: { userId: dto.userId, contactId: entry.contactId },
      });

      if (existing) {
        existing.expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
        existing.relationType = entry.relationType ?? existing.relationType;
        existing.active = true;
        await this.repo.save(existing);
      } else {
        await this.repo.save(
          this.repo.create({
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
    const all = await this.repo.find({
      where: { userId, active: true },
    });
    return all.filter((c) => !c.expiresAt || c.expiresAt > now);
  }

  /**
   * Check if user A is authorized to contact user B.
   * COM-FB-002: a user must not be able to create a conversation with an unauthorized contact.
   */
  async isAuthorized(userId: string, contactId: string): Promise<boolean> {
    const now = new Date();
    const policy = await this.repo.findOne({
      where: { userId, contactId, active: true },
    });
    if (!policy) return false;
    if (policy.expiresAt && policy.expiresAt < now) return false;
    return true;
  }
}

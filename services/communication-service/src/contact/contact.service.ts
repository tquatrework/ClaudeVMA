import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, ContactOrigin } from './entities/contact.entity';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

/** Defensive bound on unpaginated list endpoints (see services-convention). */
const DEFAULT_LIST_LIMIT = 200;

const UNIQUE_VIOLATION = '23505';

/**
 * docs/architecture/contacts-messagerie.md (2026-09-04).
 *
 * Owns the Contact aggregate: bidirectional, canonically-ordered pair, non-destructive
 * lifecycle (active/broken). Replaces the former `ContactPolicy` model entirely — that model
 * only ever read a derived, one-directional "authorization" computed from profile-service
 * relations pushed through `POST /internal/sync-contacts` (never actually called in production:
 * `contact_policies` held 0 rows). This service is the new single source of truth for contacts.
 */
@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {}

  /** Canonical, order-independent pair — a UUID is not semantically "smaller", we only need a
   *  stable, deterministic ordering so exactly one row ever represents a given pair. */
  canonicalPair(userIdA: string, userIdB: string): [string, string] {
    return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
  }

  /**
   * True if userId and otherId currently have an ACTIVE contact (point 8: messaging requires
   * this, never 'broken' nor merely a pending request).
   */
  async isActiveContact(userId: string, otherId: string): Promise<boolean> {
    const [userAId, userBId] = this.canonicalPair(userId, otherId);
    const count = await this.contactRepository.count({ where: { userAId, userBId, status: 'active' } });
    return count > 0;
  }

  /**
   * Batch variant (avoids one query per participant — N+1 — when creating a group conversation).
   * Returns the subset of otherIds that are NOT active contacts of userId.
   */
  async findInactiveContacts(userId: string, otherIds: string[]): Promise<string[]> {
    if (otherIds.length === 0) return [];

    const activeContacts = await this.contactRepository
      .createQueryBuilder('contact')
      .where('contact.status = :status', { status: 'active' })
      .andWhere(
        '((contact.user_a_id = :userId AND contact.user_b_id IN (:...otherIds)) OR ' +
          '(contact.user_b_id = :userId AND contact.user_a_id IN (:...otherIds)))',
        { userId, otherIds },
      )
      .getMany();

    const activeOtherIds = new Set(
      activeContacts.map((contact) => (contact.userAId === userId ? contact.userBId : contact.userAId)),
    );
    return otherIds.filter((otherId) => !activeOtherIds.has(otherId));
  }

  /**
   * List all currently active contacts of the calling actor, with the counterpart's userId
   * resolved (display name resolution is the caller's job — ContactRequestService/controller —
   * this service never talks to profile-service).
   */
  async listActiveContacts(
    actor: AuthenticatedUser,
  ): Promise<Array<{ contact: Contact; counterpartId: string }>> {
    const rows = await this.contactRepository.find({
      where: [
        { userAId: actor.id, status: 'active' },
        { userBId: actor.id, status: 'active' },
      ],
      order: { createdAt: 'ASC' },
      take: DEFAULT_LIST_LIMIT,
    });
    return rows.map((contact) => ({
      contact,
      counterpartId: contact.userAId === actor.id ? contact.userBId : contact.userAId,
    }));
  }

  /**
   * Idempotently ensure an ACTIVE contact exists between the two users.
   * - If an active row already exists for the pair, it is returned as-is (no-op).
   * - Otherwise a brand new row is inserted (status: 'active').
   * A pair that was previously broken is deliberately NOT resurrected in place: a fresh row is
   * inserted, leaving the broken row as proof the earlier contact existed then ended (point 6).
   * This also means a *new* business-relation event (e.g. a teacher re-linked to a student after
   * an earlier unlink) legitimately re-derives the default contact — only an explicit manual
   * break is ever undone only by an explicit manual request, never silently.
   */
  async ensureActiveContact(userIdA: string, userIdB: string, origin: ContactOrigin): Promise<Contact> {
    const [userAId, userBId] = this.canonicalPair(userIdA, userIdB);
    const existingActive = await this.contactRepository.findOne({ where: { userAId, userBId, status: 'active' } });
    if (existingActive) return existingActive;

    try {
      return await this.contactRepository.save(
        this.contactRepository.create({ userAId, userBId, status: 'active', origin }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        // Concurrent creation raced us — the partial unique index is the final arbiter.
        const winner = await this.contactRepository.findOne({ where: { userAId, userBId, status: 'active' } });
        if (winner) return winner;
      }
      throw error;
    }
  }

  /**
   * Break an active contact. Only one of the two parties may do so (point 6). Idempotent: a
   * second call on an already-broken contact returns it unchanged rather than erroring — matches
   * the finance-owner-student / teacher-student convention elsewhere in this project.
   * A contact the actor is not part of is reported as 404, never 403 — same masking discipline
   * as the rest of the project (a 403 would reveal the contact's existence to a stranger).
   */
  async breakContact(actor: AuthenticatedUser, contactId: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id: contactId } });
    if (!contact || (contact.userAId !== actor.id && contact.userBId !== actor.id)) {
      throw new NotFoundException('Contact introuvable');
    }
    if (contact.status === 'broken') return contact;

    contact.status = 'broken';
    contact.brokenAt = new Date();
    contact.brokenBy = actor.id;
    return this.contactRepository.save(contact);
  }
}

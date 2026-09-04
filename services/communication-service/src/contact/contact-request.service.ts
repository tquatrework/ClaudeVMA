import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ContactRequest } from './entities/contact-request.entity';
import { ContactService } from './contact.service';
import { ProfileServiceClient, NameSearchResult } from './clients/profile-service.client';
import { IdentityAccessClient } from './clients/identity-access.client';
import { EventPublisherService } from '../events/event-publisher.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

const DEFAULT_LIST_LIMIT = 200;
const REFUSAL_PERMANENT_BLOCK_COUNT = 3;
const REFUSAL_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 1 month (30 days)
const NAME_SEARCH_LIMIT = 20;

/**
 * docs/architecture/contacts-messagerie.md (2026-09-04), points 2-3 and 7:
 * the manual contact-request flow — search, request, accept/decline, and the directed,
 * append-only refusal penalty (1-month cooldown, permanent block at the 3rd refusal).
 */
@Injectable()
export class ContactRequestService {
  constructor(
    @InjectRepository(ContactRequest)
    private readonly contactRequestRepository: Repository<ContactRequest>,
    private readonly contactService: ContactService,
    private readonly profileServiceClient: ProfileServiceClient,
    private readonly identityAccessClient: IdentityAccessClient,
    private readonly eventPublisher: EventPublisherService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------------------
  // Search (point 2, 10, 11)
  // ---------------------------------------------------------------------------------------

  /** Exact match by loginIdentifier (identity-access-service), then name resolution (profile-service). */
  async searchByLoginIdentifier(
    actor: AuthenticatedUser,
    loginIdentifier: string,
  ): Promise<NameSearchResult | null> {
    const account = await this.identityAccessClient.findByLoginIdentifier(loginIdentifier);
    if (!account || account.userId === actor.id) return null;

    const displayName = await this.profileServiceClient.getDisplayName(account.userId);
    return {
      userId: account.userId,
      firstName: displayName?.firstName ?? null,
      lastName: displayName?.lastName ?? null,
      loginIdentifier: account.loginIdentifier,
    };
  }

  /** Free-text name search (profile-service, composed with identity-access-service loginIdentifier). */
  async searchByName(actor: AuthenticatedUser, query: string): Promise<NameSearchResult[]> {
    const results = await this.profileServiceClient.searchByName(query);
    return results.filter((result) => result.userId !== actor.id).slice(0, NAME_SEARCH_LIMIT);
  }

  // ---------------------------------------------------------------------------------------
  // Request lifecycle (points 2-3, 7, 9)
  // ---------------------------------------------------------------------------------------

  async listIncoming(actor: AuthenticatedUser): Promise<ContactRequest[]> {
    return this.contactRequestRepository.find({
      where: { targetId: actor.id, status: 'pending' },
      order: { createdAt: 'DESC' },
      take: DEFAULT_LIST_LIMIT,
    });
  }

  async listOutgoing(actor: AuthenticatedUser): Promise<ContactRequest[]> {
    return this.contactRequestRepository.find({
      where: { requesterId: actor.id },
      order: { createdAt: 'DESC' },
      take: DEFAULT_LIST_LIMIT,
    });
  }

  async createRequest(actor: AuthenticatedUser, targetId: string): Promise<ContactRequest> {
    if (targetId === actor.id) {
      throw new BadRequestException('Vous ne pouvez pas vous demander vous-même en contact');
    }

    // Validate the target actually exists (degrades to 404 like the rest of the project when
    // identity-access-service/profile-service don't know this userId).
    const displayName = await this.profileServiceClient.getDisplayName(targetId);
    if (!displayName) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (await this.contactService.isActiveContact(actor.id, targetId)) {
      throw new ConflictException('Vous êtes déjà en contact avec cette personne');
    }

    await this.assertNotBlocked(actor.id, targetId);

    const existingPending = await this.contactRequestRepository.findOne({
      where: { requesterId: actor.id, targetId, status: 'pending' },
    });
    if (existingPending) return existingPending;

    let created: ContactRequest;
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContactRequest);
      created = await repository.save(
        repository.create({ requesterId: actor.id, targetId, status: 'pending' }),
      );
      await this.eventPublisher.record(
        manager,
        'ContactRequestCreated',
        'ContactRequest',
        created.id,
        { requestId: created.id, requesterId: actor.id, targetId },
      );
    });
    return created!;
  }

  async acceptRequest(actor: AuthenticatedUser, requestId: string): Promise<ContactRequest> {
    const contactRequest = await this.findOwnedIncomingRequest(actor.id, requestId);
    if (contactRequest.status !== 'pending') {
      throw new ConflictException('Cette demande a déjà été traitée');
    }

    let updated: ContactRequest;
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContactRequest);
      contactRequest.status = 'accepted';
      contactRequest.respondedAt = new Date();
      updated = await repository.save(contactRequest);

      await this.contactService.ensureActiveContact(contactRequest.requesterId, contactRequest.targetId, 'request');

      await this.eventPublisher.record(
        manager,
        'ContactRequestAccepted',
        'ContactRequest',
        contactRequest.id,
        { requestId: contactRequest.id, requesterId: contactRequest.requesterId, targetId: contactRequest.targetId },
      );
    });
    return updated!;
  }

  async declineRequest(actor: AuthenticatedUser, requestId: string): Promise<ContactRequest> {
    const contactRequest = await this.findOwnedIncomingRequest(actor.id, requestId);
    if (contactRequest.status !== 'pending') {
      throw new ConflictException('Cette demande a déjà été traitée');
    }

    let updated: ContactRequest;
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ContactRequest);
      contactRequest.status = 'declined';
      contactRequest.respondedAt = new Date();
      updated = await repository.save(contactRequest);

      await this.eventPublisher.record(
        manager,
        'ContactRequestDeclined',
        'ContactRequest',
        contactRequest.id,
        { requestId: contactRequest.id, requesterId: contactRequest.requesterId, targetId: contactRequest.targetId },
      );
    });
    return updated!;
  }

  // ---------------------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------------------

  private async findOwnedIncomingRequest(actorId: string, requestId: string): Promise<ContactRequest> {
    const contactRequest = await this.contactRequestRepository.findOne({
      where: { id: requestId, targetId: actorId },
    });
    if (!contactRequest) throw new NotFoundException(`Contact request ${requestId} not found`);
    return contactRequest;
  }

  /**
   * point 7: after a refusal, the requester cannot re-request the same target for one month;
   * at the 3rd cumulative refusal for this exact directed pair, the block becomes permanent.
   * Directional only — never checked against the reverse pair (targetId -> requesterId).
   */
  private async assertNotBlocked(requesterId: string, targetId: string): Promise<void> {
    const declinedRequests = await this.contactRequestRepository.find({
      where: { requesterId, targetId, status: 'declined' },
      order: { respondedAt: 'DESC' },
    });
    if (declinedRequests.length === 0) return;

    if (declinedRequests.length >= REFUSAL_PERMANENT_BLOCK_COUNT) {
      throw new ForbiddenException(
        'Cette personne a refusé votre demande à plusieurs reprises : vous ne pouvez plus la solliciter',
      );
    }

    const lastRefusal = declinedRequests[0];
    const lastRefusalAt = lastRefusal.respondedAt ?? lastRefusal.createdAt;
    const cooldownEndsAt = new Date(lastRefusalAt.getTime() + REFUSAL_COOLDOWN_MS);
    if (cooldownEndsAt > new Date()) {
      throw new ForbiddenException(
        `Votre demande a été refusée récemment : vous pourrez la renouveler à partir du ${cooldownEndsAt.toISOString()}`,
      );
    }
  }
}

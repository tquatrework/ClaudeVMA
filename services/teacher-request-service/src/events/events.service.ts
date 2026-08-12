import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { DomainEvent } from './entities/domain-event.entity';
import { EventPublisher } from './event-publisher.service';

/** Evenements metier produits par le flow de la demande de professeur. */
export enum TeacherRequestEvent {
  REQUEST_CREATED = 'TeacherRequestCreated',
  REQUEST_STATUS_UPDATED = 'TeacherRequestStatusUpdated',
  REQUEST_DELETED = 'TeacherRequestDeleted',
  REQUEST_CLOSED = 'TeacherRequestClosed',
  PROPOSAL_SENT = 'TeacherProposalSent',
  PROPOSAL_ACCEPTED = 'TeacherProposalAccepted',
  PROPOSAL_DECLINED = 'TeacherProposalDeclined',
  PROPOSAL_NOT_SELECTED = 'TeacherProposalNotSelected',
  PROPOSAL_EXPIRED = 'TeacherProposalExpired',
  TEACHER_ASSIGNED = 'TeacherAssigned',
  MAIN_TEACHER_ASSIGNED = 'MainTeacherAssigned',
  STOP_REQUESTED = 'TeacherStopRequested',
}

export interface DomainEventInput {
  eventName: TeacherRequestEvent;
  aggregateType: 'TeacherRequest' | 'TeacherProposal' | 'Assignment';
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Ecrit les evenements metier dans la boite d'envoi.
 *
 * Avant le 2026-08-12, `emit()` ecrivait UNE LIGNE DE LOG et rien d'autre :
 * aucun bus, aucun abonne, rien de ce que produisait ce service n'atteignait un
 * autre service. L'arbitrage l'a explicitement interdit — « un evenement qui
 * n'est qu'un logger.log n'est pas un evenement ».
 *
 * L'ecriture accepte un `EntityManager` pour etre embarquee dans la MEME
 * transaction que le changement d'etat : soit les deux sont en base, soit
 * aucun. Un evenement ne peut donc pas annoncer un fait qui n'a pas eu lieu.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(DomainEvent) private readonly eventRepo: Repository<DomainEvent>,
    private readonly publisher: EventPublisher,
  ) {}

  async record(input: DomainEventInput, manager?: EntityManager): Promise<DomainEvent> {
    const repository = manager ? manager.getRepository(DomainEvent) : this.eventRepo;
    const domainEvent = repository.create({
      eventName: input.eventName,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload,
      correlationId: input.correlationId ?? null,
      publishedAt: null,
      publishAttempts: 0,
    });
    const saved = await repository.save(domainEvent);
    this.logger.log(`${input.eventName} enregistre (${input.aggregateType} ${input.aggregateId})`);
    return saved;
  }

  /**
   * A appeler UNE FOIS la transaction validee : declenche la remise au bus.
   * Appele avant le commit, on publierait un evenement qu'un rollback pourrait
   * encore annuler.
   */
  requestPublication(): void {
    this.publisher.scheduleFlush();
  }
}

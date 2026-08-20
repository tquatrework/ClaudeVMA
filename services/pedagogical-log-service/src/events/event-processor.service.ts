import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityProjection } from './entities/activity-projection.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { PedagogicalLog } from '../pedagogical-log/entities/pedagogical-log.entity';

/**
 * Traite les événements du flux Redis `visiomath:events` consommés par ce
 * service — point 5 de la refonte du cahier de texte (2026-08-20).
 *
 * `ActivityScheduled` (calendar-service) : projeté localement (activity_projections).
 * `ActivityConfirmed` (calendar-service) : si l'activité projetée est de type
 * `cours`, crée automatiquement une entrée de cahier de texte vide (seule `date`
 * renseignée), `studentId` = recipientId, `authorId` = creatorId, `activityId`
 * renseigné. Idempotent par eventId (processed_events) et, en défense
 * supplémentaire, par (activityId, autoCreated=true).
 *
 * Tout eventName non reconnu est journalisé en avertissement puis marqué traité
 * sans effet — jamais bloquant (même politique que dashboard-notification-service).
 */
@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ActivityProjection)
    private readonly projections: Repository<ActivityProjection>,
    @InjectRepository(ProcessedEvent)
    private readonly processedEvents: Repository<ProcessedEvent>,
  ) {}

  async process(record: Record<string, string>): Promise<void> {
    const eventId = record.eventId;
    const eventName = record.eventName;

    if (!eventId || !eventName) {
      this.logger.warn('malformed stream entry — missing eventId or eventName, skipped');
      return;
    }

    const alreadyProcessed = await this.processedEvents.findOne({ where: { eventId } });
    if (alreadyProcessed) {
      return;
    }

    let payload: Record<string, unknown> = {};
    if (record.payload) {
      try {
        payload = JSON.parse(record.payload);
      } catch {
        this.logger.warn(`event ${eventId} (${eventName}) has malformed JSON payload — skipped`);
        return;
      }
    }

    switch (eventName) {
      case 'ActivityScheduled':
        await this.handleActivityScheduled(eventId, payload);
        break;
      case 'ActivityConfirmed':
        await this.handleActivityConfirmed(eventId, payload);
        break;
      default:
        this.logger.warn(`unrecognized eventName "${eventName}" — acknowledged without effect`);
        await this.processedEvents.save({ eventId, eventType: eventName });
    }
  }

  private async handleActivityScheduled(eventId: string, payload: Record<string, unknown>): Promise<void> {
    const activityId = payload.activityId as string | undefined;
    if (!activityId) {
      this.logger.warn(`ActivityScheduled ${eventId} without activityId — skipped`);
      await this.processedEvents.save({ eventId, eventType: 'ActivityScheduled' });
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ActivityProjection).save({
        activityId,
        type: (payload.type as string) ?? null,
        creatorId: (payload.creatorId as string) ?? null,
        recipientId: (payload.recipientId as string) ?? null,
        participantIds: (payload.participantIds as string[]) ?? [],
        startTime: payload.startTime ? new Date(payload.startTime as string) : new Date(),
      });
      await manager.getRepository(ProcessedEvent).save({ eventId, eventType: 'ActivityScheduled' });
    });
  }

  private async handleActivityConfirmed(eventId: string, payload: Record<string, unknown>): Promise<void> {
    const activityId = payload.activityId as string | undefined;
    if (!activityId) {
      this.logger.warn(`ActivityConfirmed ${eventId} without activityId — skipped`);
      await this.processedEvents.save({ eventId, eventType: 'ActivityConfirmed' });
      return;
    }

    const projection = await this.projections.findOne({ where: { activityId } });

    if (!projection) {
      this.logger.warn(
        `ActivityConfirmed for unknown activity ${activityId} — no ActivityScheduled projection observed, no entry created`,
      );
      await this.processedEvents.save({ eventId, eventType: 'ActivityConfirmed' });
      return;
    }

    if (projection.type !== 'cours') {
      await this.processedEvents.save({ eventId, eventType: 'ActivityConfirmed' });
      return;
    }

    if (!projection.recipientId) {
      this.logger.warn(
        `ActivityConfirmed cours ${activityId} without recipientId — cannot create pedagogical log entry`,
      );
      await this.processedEvents.save({ eventId, eventType: 'ActivityConfirmed' });
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const logRepository = manager.getRepository(PedagogicalLog);
      const existing = await logRepository.findOne({ where: { activityId, autoCreated: true } });

      if (!existing) {
        await logRepository.save(
          logRepository.create({
            studentId: projection.recipientId,
            authorId: projection.creatorId,
            authorRole: 'formateur',
            activityId,
            date: projection.startTime.toISOString().slice(0, 10),
            visibility: 'eleve_parent_formateur',
            isSpecialPage: false,
            hiddenFromStudent: false,
            autoCreated: true,
          }),
        );
      }

      await manager.getRepository(ProcessedEvent).save({ eventId, eventType: 'ActivityConfirmed' });
    });
  }
}

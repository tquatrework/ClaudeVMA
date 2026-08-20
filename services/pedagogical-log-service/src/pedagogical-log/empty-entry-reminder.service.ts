import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, IsNull, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PedagogicalLog } from './entities/pedagogical-log.entity';
import { DashboardNotificationClient } from '../common/clients/dashboard-notification.client';

/**
 * Rappel quotidien au formateur pour les entrées auto-créées à la confirmation
 * d'une activité `cours` (voir EventProcessorService) restées vides plus de 24h
 * après la séance — point 5 (complément) de la refonte du cahier de texte,
 * 2026-08-20.
 *
 * Approximation assumée : `ActivityScheduled` (calendar-service) ne porte pas la
 * date de fin de l'activité, seulement `startTime` — reprise ici comme `date` sur
 * l'entrée. Le rappel se déclenche donc 24h après la date de séance elle-même,
 * pas 24h après l'heure de fin réelle du cours (non disponible). Point ouvert,
 * documenté dans docs/services/pedagogical-log-service.md.
 *
 * Rappel garanti unique par entrée : `remindedAt` est posé après un envoi réussi
 * et jamais réinitialisé — un échec d'envoi laisse l'entrée éligible au prochain
 * passage (auto-guérison, pas de perte silencieuse).
 */
@Injectable()
export class EmptyEntryReminderService {
  private readonly logger = new Logger(EmptyEntryReminderService.name);

  constructor(
    @InjectRepository(PedagogicalLog)
    private readonly repository: Repository<PedagogicalLog>,
    private readonly notifier: DashboardNotificationClient,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async remindUnfilledAutoEntries(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const candidates = await this.repository.find({
      where: {
        autoCreated: true,
        remindedAt: IsNull(),
        sessionSummary: IsNull(),
        homework: IsNull(),
        date: LessThan(cutoffDate),
      },
    });

    for (const entry of candidates) {
      await this.remindOne(entry);
    }
  }

  private async remindOne(entry: PedagogicalLog): Promise<void> {
    try {
      await this.notifier.notifyUser(
        entry.authorId,
        'pedagogical_log_entry_empty',
        'Cahier de texte à compléter',
        `La séance du ${entry.date} n'a toujours pas de compte-rendu dans le cahier de texte.`,
        { pedagogicalLogId: entry.id, studentId: entry.studentId, activityId: entry.activityId, date: entry.date },
      );
      entry.remindedAt = new Date();
      await this.repository.save(entry);
    } catch (error) {
      this.logger.error(
        `failed to notify formateur ${entry.authorId} for entry ${entry.id}: ${(error as Error).message} — retried next run`,
      );
    }
  }
}

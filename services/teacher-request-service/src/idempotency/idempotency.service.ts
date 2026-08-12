import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { IdempotencyRecord } from './idempotency-record.entity';

const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Rend une commande rejouable sans effet de bord.
 *
 * Contrat technique du projet : les commandes orchestrables doivent accepter
 * une cle d'idempotence. Mesure le 2026-08-11 : trois `POST /teacher-requests`
 * identiques creaient trois demandes distinctes.
 *
 * Sans en-tete `Idempotency-Key`, le comportement est inchange — la cle est un
 * engagement pris par l'appelant, pas une contrainte imposee a tous.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly idempotencyRepo: Repository<IdempotencyRecord>,
  ) {}

  async runOnce<TResult>(
    parameters: { idempotencyKey?: string; endpoint: string; userId: string },
    command: () => Promise<TResult>,
  ): Promise<TResult> {
    const { idempotencyKey, endpoint, userId } = parameters;
    if (!idempotencyKey) return command();

    const alreadyExecuted = await this.idempotencyRepo.findOne({
      where: { idempotencyKey, endpoint, userId },
    });
    if (alreadyExecuted) {
      this.logger.log(`Commande rejouee sans effet : ${endpoint} (cle ${idempotencyKey})`);
      return alreadyExecuted.responseBody as TResult;
    }

    const result = await command();

    try {
      await this.idempotencyRepo.save(
        this.idempotencyRepo.create({
          idempotencyKey,
          endpoint,
          userId,
          responseBody: result as unknown,
        }),
      );
    } catch (error) {
      // Deux appels concurrents portant la meme cle : le perdant relit la
      // reponse du gagnant plutot que de remonter une erreur technique.
      const isUniqueViolation =
        error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION_CODE;
      if (!isUniqueViolation) throw error;
      this.logger.warn(`Cle d'idempotence en concurrence sur ${endpoint} (cle ${idempotencyKey})`);
    }

    return result;
  }
}

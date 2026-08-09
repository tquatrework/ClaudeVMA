import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  ConsentAction,
  ConsentRecord,
  ConsentType,
  isWithdrawableConsent,
} from './entities/consent-record.entity';
import { CreateConsentDto } from './dto/create-consent.dto';
import { ConsentStateDto } from './dto/consent-state.dto';
import { ConsentEventDto } from './dto/consent-event.dto';
import { ConsentRecordingService } from './consent-recording.service';
import { EventsService } from '../events/events.service';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class ConsentsService {
  constructor(
    private readonly consentRecordingService: ConsentRecordingService,
    private readonly eventsService: EventsService,
    private readonly accountsService: AccountsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Enregistre un octroi de consentement et, le cas échéant, active le compte
   * (IAM-FB-003). Les deux écritures (ConsentRecord via ConsentRecordingService
   * + User délégué à AccountsService) sont atomiques via DataSource.transaction ;
   * l'événement métier n'est publié qu'après le commit.
   *
   * Le `409` porte sur l'ÉTAT COURANT, pas sur l'existence d'une ligne : un
   * consentement retiré doit pouvoir être redonné, et le cycle accorder →
   * retirer → accorder doit fonctionner autant de fois que l'utilisateur le
   * souhaite (arbitrage du 2026-08-09). Tester l'existence d'une ligne
   * interdirait définitivement de ré-accepter après un retrait.
   *
   * Cette route reste nécessaire après l'inscription : re-consentement,
   * changement de version d'un document, et consentement facultatif
   * (`marketing`) signé plus tard.
   */
  async signConsent(userId: string, dto: CreateConsentDto, ipAddress?: string): Promise<ConsentRecord> {
    const isAlreadyGranted = await this.consentRecordingService.isConsentGranted(
      userId,
      dto.consentType,
    );
    if (isAlreadyGranted) throw new ConflictException(`Consent ${dto.consentType} already granted`);

    const record = await this.dataSource.transaction(async (manager) => {
      const savedRecord = await this.consentRecordingService.recordConsent(
        {
          userId,
          consentType: dto.consentType,
          action: ConsentAction.GRANTED,
          version: dto.version,
          ipAddress,
        },
        manager,
      );

      await this.activateAccountIfReady(userId, manager);

      return savedRecord;
    });

    this.eventsService.publish('ConsentSigned', {
      userId,
      consentType: dto.consentType,
      version: record.version,
    });

    return record;
  }

  /**
   * Retire un consentement optionnel — RGPD : retirer doit être aussi simple que
   * donner.
   *
   * Le retrait AJOUTE un événement `withdrawn` au journal. Il ne supprime ni ne
   * modifie aucune ligne : on doit pouvoir prouver que le consentement avait été
   * donné, puis retiré, et quand.
   *
   * Aucun effet sur le compte, par construction : seuls les consentements
   * optionnels sont retirables, donc `consent_signed` et le passage à `active`,
   * qui ne dépendent que des consentements obligatoires, ne peuvent pas être
   * remis en cause. Retirer `marketing` ne désactive jamais un compte — d'où
   * l'absence délibérée d'appel à `AccountsService` ici.
   *
   * @throws ForbiddenException si le consentement est obligatoire (rgpd, cgu)
   * @throws NotFoundException si l'utilisateur ne l'a jamais donné
   * @throws ConflictException s'il est déjà retiré
   */
  async withdrawConsent(
    userId: string,
    consentType: ConsentType,
    ipAddress?: string,
  ): Promise<ConsentRecord> {
    this.assertConsentIsWithdrawable(consentType);

    const currentConsent = await this.consentRecordingService.findCurrentConsent(userId, consentType);

    if (!currentConsent) {
      throw new NotFoundException(
        `No ${consentType} consent to withdraw: this account has never granted it.`,
      );
    }

    if (currentConsent.action === ConsentAction.WITHDRAWN) {
      throw new ConflictException(`Consent ${consentType} is already withdrawn`);
    }

    // La version retirée est celle du consentement en vigueur : le journal doit
    // dire QUEL document a été révoqué, pas la version courante du document.
    const withdrawalRecord = await this.consentRecordingService.recordConsent({
      userId,
      consentType,
      action: ConsentAction.WITHDRAWN,
      version: currentConsent.version,
      ipAddress,
    });

    this.eventsService.publish('ConsentWithdrawn', {
      userId,
      consentType,
      version: withdrawalRecord.version,
    });

    return withdrawalRecord;
  }

  /**
   * État courant de chaque type de consentement — jamais les lignes brutes du
   * journal, qui feraient afficher « Signé » sur un consentement retiré.
   */
  async getConsentStates(userId: string): Promise<ConsentStateDto[]> {
    const consentStates = await this.consentRecordingService.getConsentStates(userId);
    return consentStates.map((consentState) => ConsentStateDto.fromConsentState(consentState));
  }

  /** Journal complet, du plus ancien au plus récent : la preuve. */
  async getConsentHistory(userId: string): Promise<ConsentEventDto[]> {
    const consentHistory = await this.consentRecordingService.listConsentHistory(userId);
    return consentHistory.map((consentRecord) => ConsentEventDto.fromConsentRecord(consentRecord));
  }

  /**
   * Refuse explicitement le retrait d'un consentement obligatoire, en orientant
   * vers le bon parcours. Une tentative ne doit jamais être absorbée en silence
   * ni traitée comme un succès (arbitrage du 2026-08-09).
   */
  private assertConsentIsWithdrawable(consentType: ConsentType): void {
    if (isWithdrawableConsent(consentType)) return;

    throw new ForbiddenException(
      `Consent ${consentType} is mandatory and cannot be withdrawn: it conditions the use of the service. ` +
        'Revoking it means closing the account, which is a separate flow — contact support.',
    );
  }

  /**
   * Vérifie si tous les consentements obligatoires (IAM-FB-003) sont accordés.
   * L'invariance appartient au propriétaire de ConsentRecord
   * (ConsentRecordingService) ; l'effet sur le compte (User, possédé par
   * AccountsModule) est délégué à AccountsService, dans la même transaction.
   */
  private async activateAccountIfReady(userId: string, manager: EntityManager): Promise<void> {
    const areAllRequiredGranted = await this.consentRecordingService.areMandatoryConsentsGranted(
      userId,
      manager,
    );
    if (!areAllRequiredGranted) return;

    await this.accountsService.activateAfterMandatoryConsents(userId, manager);
  }
}

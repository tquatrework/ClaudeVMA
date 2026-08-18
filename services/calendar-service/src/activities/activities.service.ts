import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledActivity, ActivityType, ActivityStatus } from './entities/scheduled-activity.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../common/clients/profile-relations.client';
import { RelationKind } from '../common/relations/relation-kind';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(ScheduledActivity)
    private readonly activityRepo: Repository<ScheduledActivity>,
    private readonly eventsService: EventsService,
    private readonly profileRelationsClient: ProfileRelationsClient,
  ) {}

  /**
   * Create a scheduled activity.
   * CAL-BR-007: student(s) may be participants.
   * CAL-BR-008: AP or RP can propose activities to teachers.
   * CAL-FB-002: at least one participant and a valid time range required.
   * CAL-FB-003: AP can only propose pedagogical meetings.
   *
   * Chantier calendrier de disponibilités, point 3 : une proposition
   * `cours` par un FORMATEUR ou `reunion_pedagogique` par un AP exige
   * exactement un destinataire ET une relation métier réelle avec lui
   * (`TEACHER_OF_STUDENT` / `ANIMATOR_OF_TEACHER`, vérifiées auprès de
   * `profile-service` — voir `validateActivityCreation`). Corrige un trou
   * de sécurité réel : jusqu'ici aucun lien n'était vérifié, un formateur
   * pouvait proposer un cours à n'importe quel élève.
   */
  async create(
    dto: CreateActivityDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<ScheduledActivity> {
    await this.validateActivityCreation(dto, actor, correlationId);

    const activity = await this.activityRepo.save(
      this.activityRepo.create({
        title: dto.title,
        type: dto.type,
        creatorId: actor.id,
        creatorRole: actor.role,
        participantIds: dto.participantIds,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        description: dto.description ?? null,
        correlationId: dto.correlationId ?? correlationId ?? null,
      }),
    );

    this.eventsService.publish(
      'ActivityScheduled',
      {
        activityId: activity.id,
        type: activity.type,
        creatorId: actor.id,
        participantIds: activity.participantIds,
        startTime: activity.startTime,
      },
      correlationId ?? dto.correlationId,
    );

    return activity;
  }

  /**
   * Update a scheduled activity (CAL-BR-010: publishes ActivityUpdated).
   * CAL-FB-001: only creator, RP, or TI can update.
   */
  async update(
    activityId: string,
    dto: UpdateActivityDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<ScheduledActivity> {
    const activity = await this.findOneOrFail(activityId);
    this.assertCanModifyActivity(activity, actor);

    // CAL-FB-002: if participantIds updated, must remain non-empty (validated by DTO)
    const updated = await this.activityRepo.save({
      ...activity,
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : activity.startTime,
      endTime: dto.endTime ? new Date(dto.endTime) : activity.endTime,
      correlationId: dto.correlationId ?? activity.correlationId,
    });

    this.eventsService.publish(
      'ActivityUpdated',
      {
        activityId: updated.id,
        changes: Object.keys(dto),
        updatedBy: actor.id,
      },
      correlationId ?? dto.correlationId,
    );

    return updated;
  }

  async findOne(activityId: string, actor: AuthenticatedUser): Promise<ScheduledActivity> {
    const activity = await this.findOneOrFail(activityId);
    this.assertCanReadActivity(activity, actor);
    return activity;
  }

  /**
   * Delete a scheduled activity.
   * CAL-FB-001: only creator, RP, or TI can delete — same policy as `update`
   * above, reusing `assertCanModifyActivity` unchanged. Hard delete: an
   * activity is operational scheduling data, not a record with
   * probative/audit value (same reasoning as
   * `CalendarsService.deleteSlot`).
   */
  async remove(
    activityId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<void> {
    const activity = await this.findOneOrFail(activityId);
    this.assertCanModifyActivity(activity, actor);

    await this.activityRepo.delete({ id: activity.id });

    this.eventsService.publish(
      'ActivityDeleted',
      { activityId: activity.id, deletedBy: actor.id },
      correlationId,
    );
  }

  /**
   * Accept a PROPOSED activity — transition PROPOSED → CONFIRMED.
   *
   * Sur le modèle exact d'`EventInvitationsController`/
   * `CalendarEventsService.acceptInvitation` : garde de statut (`409` si
   * déjà traité), seul le destinataire visé (`participantIds`) peut
   * répondre, événement de domaine publié à la transition.
   *
   * Portée volontairement limitée aux propositions 1 proposeur → 1
   * destinataire (voir `validateActivityCreation`) : la vérification
   * ci-dessous reste générique (n'importe quel participant peut accepter),
   * mais en pratique seuls `cours`/FORMATEUR et `reunion_pedagogique`/AP
   * ou RP créent des activités à un seul destinataire — les usages
   * multi-participants existants (`entretien_rp`, `rappel`, `autre`,
   * `reunion_pedagogique` RP à plusieurs formateurs) ne passent pas par ce
   * flow et ne sont pas touchés par ce changement.
   */
  async accept(
    activityId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<ScheduledActivity> {
    const activity = await this.findOneOrFail(activityId);
    this.assertActorIsTargetedRecipient(activity, actor);

    if (activity.status !== ActivityStatus.PROPOSED) {
      throw new ConflictException(
        `Activity is already ${activity.status} — cannot accept`,
      );
    }

    activity.status = ActivityStatus.CONFIRMED;
    const updated = await this.activityRepo.save(activity);

    this.eventsService.publish(
      'ActivityConfirmed',
      { activityId: updated.id, confirmedBy: actor.id },
      correlationId,
    );

    return updated;
  }

  /**
   * Decline a PROPOSED activity — transition PROPOSED → CANCELLED.
   * Same model as `accept` above (and `EventInvitationsController.decline`).
   */
  async decline(
    activityId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<ScheduledActivity> {
    const activity = await this.findOneOrFail(activityId);
    this.assertActorIsTargetedRecipient(activity, actor);

    if (activity.status !== ActivityStatus.PROPOSED) {
      throw new ConflictException(
        `Activity is already ${activity.status} — cannot decline`,
      );
    }

    activity.status = ActivityStatus.CANCELLED;
    const updated = await this.activityRepo.save(activity);

    this.eventsService.publish(
      'ActivityDeclined',
      { activityId: updated.id, declinedBy: actor.id },
      correlationId,
    );

    return updated;
  }

  async findByParticipant(userId: string): Promise<ScheduledActivity[]> {
    // simple-json column: use query builder for portability
    return this.activityRepo
      .createQueryBuilder('activity')
      .where("activity.participant_ids LIKE :uid", { uid: `%${userId}%` })
      .orderBy('activity.start_time', 'ASC')
      .getMany();
  }

  /**
   * Activités où `userId` est créateur OU participant, à l'état
   * `PROPOSED`/`CONFIRMED` (les seuls qui occupent réellement le calendrier —
   * `CANCELLED`/`COMPLETED` n'ont plus de raison de bloquer un créneau),
   * chevauchant `[from, to)`.
   *
   * Consommé par `CalendarsService.getBusyFree` pour produire `busyBlocks`
   * de `GET /calendars/:ownerId/busy` — jamais exposé tel quel (pas d'id, de
   * titre, de type ni de participants dans la réponse busy/free, voir
   * `docs/routes.md`).
   *
   * `participant_ids` est une colonne `simple-json` : filtrage par `LIKE`,
   * même approche que `findByParticipant` ci-dessus, pour la même raison de
   * portabilité (pas de fonction JSON spécifique au moteur).
   */
  async findActiveInRange(userId: string, from: Date, to: Date): Promise<ScheduledActivity[]> {
    return this.activityRepo
      .createQueryBuilder('activity')
      .where('(activity.creator_id = :userId OR activity.participant_ids LIKE :uid)', {
        userId,
        uid: `%${userId}%`,
      })
      .andWhere('activity.status IN (:...statuses)', {
        statuses: [ActivityStatus.PROPOSED, ActivityStatus.CONFIRMED],
      })
      // Chevauchement demi-ouvert, même sémantique que `intersects()` dans
      // `recurrence.util.ts` : start < to ET end > from.
      .andWhere('activity.start_time < :to', { to })
      .andWhere('activity.end_time > :from', { from })
      .orderBy('activity.start_time', 'ASC')
      .getMany();
  }

  // ---- Private helpers ----

  private async findOneOrFail(activityId: string): Promise<ScheduledActivity> {
    const foundActivity = await this.activityRepo.findOne({ where: { id: activityId } });
    if (!foundActivity) throw new NotFoundException(`Activity ${activityId} not found`);
    return foundActivity;
  }

  /**
   * CAL-FB-002: Validate that business constraints on creation are met.
   * CAL-FB-003: AP can only propose pedagogical meetings to teachers in their scope
   *   (scope enforcement is caller-side for Phase 1; the type constraint is enforced here).
   *
   * Chantier calendrier de disponibilités, point 3 :
   *  - `cours` créé par un FORMATEUR, ou `reunion_pedagogique` créé par un
   *    ANIMATEUR_PEDAGOGIQUE, doivent cibler EXACTEMENT un destinataire
   *    (`400` sinon) — ce sont les seuls cas couverts par le flow
   *    accepter/refuser 1 proposeur → 1 destinataire. Un RP créant une
   *    `reunion_pedagogique` à plusieurs formateurs (usage existant,
   *    inchangé) n'est PAS soumis à cette contrainte.
   *  - un vrai lien métier avec le destinataire est exigé pour ces deux
   *    mêmes cas (`TEACHER_OF_STUDENT` pour FORMATEUR→élève,
   *    `ANIMATOR_OF_TEACHER` pour AP→formateur), vérifié auprès de
   *    `profile-service` — `403` si absent. Un RP n'a aucune vérification
   *    de lien (accès non conditionnel partout ailleurs dans ce service).
   */
  private async validateActivityCreation(
    dto: CreateActivityDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<void> {
    if (dto.participantIds.length === 0) {
      throw new BadRequestException('CAL-FB-002: At least one participant is required');
    }

    // CAL-FB-003: AP can only create REUNION_PEDAGOGIQUE
    if (
      actor.role === UserRole.ANIMATEUR_PEDAGOGIQUE &&
      dto.type !== ActivityType.REUNION_PEDAGOGIQUE
    ) {
      throw new ForbiddenException(
        'CAL-FB-003: AP can only create pedagogical meetings (reunion_pedagogique)',
      );
    }

    const isCoursByTeacher =
      dto.type === ActivityType.COURS && actor.role === UserRole.FORMATEUR;
    const isReunionByAnimator =
      dto.type === ActivityType.REUNION_PEDAGOGIQUE &&
      actor.role === UserRole.ANIMATEUR_PEDAGOGIQUE;

    if ((isCoursByTeacher || isReunionByAnimator) && dto.participantIds.length !== 1) {
      throw new BadRequestException(
        'Une proposition de cours ou de réunion pédagogique ne peut cibler ' +
          "qu'un seul destinataire (participantIds doit contenir exactement un identifiant)",
      );
    }

    if (isCoursByTeacher) {
      await this.assertLinkedRecipient(
        actor,
        dto.participantIds[0],
        RelationKind.TEACHER_OF_STUDENT,
        correlationId,
        "Vous ne pouvez proposer un cours qu'à un élève auquel vous êtes lié",
      );
    }

    if (isReunionByAnimator) {
      await this.assertLinkedRecipient(
        actor,
        dto.participantIds[0],
        RelationKind.ANIMATOR_OF_TEACHER,
        correlationId,
        'Vous ne pouvez proposer une réunion pédagogique qu\'à un formateur que vous animez',
      );
    }
  }

  /**
   * `403` si `actor` (le proposeur) n'a pas la relation métier requise
   * avec `recipientId`, `503` si `profile-service` est injoignable ou hors
   * délai — échec fermé, jamais une création acceptée par défaut. Copié
   * du modèle déjà suivi par `CalendarsService.getBusyFree` (point 2 de ce
   * chantier).
   */
  private async assertLinkedRecipient(
    actor: AuthenticatedUser,
    recipientId: string,
    requiredRelationKind: RelationKind,
    correlationId: string | undefined,
    forbiddenMessage: string,
  ): Promise<void> {
    let snapshot;
    try {
      snapshot = await this.profileRelationsClient.resolveRelations(
        actor.id,
        recipientId,
        actor.role,
        correlationId,
      );
    } catch (error) {
      if (error instanceof ProfileRelationsUnavailableError) {
        throw new ServiceUnavailableException(
          "Impossible de vérifier le lien avec le destinataire pour le moment. " +
            'Réessayez dans un instant.',
        );
      }
      throw error;
    }

    const hasRequiredRelation = snapshot.relations.some(
      (relation) => relation.kind === requiredRelationKind,
    );
    if (!hasRequiredRelation) {
      throw new ForbiddenException(forbiddenMessage);
    }
  }

  /**
   * IDOR guard: user can read an activity only if they are the creator,
   * a declared participant, or hold an internal privileged role (RP, TI, AF).
   */
  private assertCanReadActivity(activity: ScheduledActivity, actor: AuthenticatedUser): void {
    const readRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (activity.creatorId === actor.id) return;
    if (activity.participantIds.includes(actor.id)) return;
    if (readRoles.includes(actor.role)) return;
    throw new ForbiddenException('Access to this activity is not allowed');
  }

  /**
   * Only a declared participant (the targeted recipient of the proposal)
   * may accept or decline an activity — same posture as
   * `CalendarEventsService.assertActorIsInvitee`. The creator themselves
   * is NOT allowed to accept/decline their own proposal.
   */
  private assertActorIsTargetedRecipient(
    activity: ScheduledActivity,
    actor: AuthenticatedUser,
  ): void {
    if (!activity.participantIds.includes(actor.id)) {
      throw new ForbiddenException(
        'Only the targeted recipient may accept or decline this activity',
      );
    }
  }

  /**
   * CAL-FB-001: Only creator, RP, or TI can update an activity.
   */
  private assertCanModifyActivity(activity: ScheduledActivity, actor: AuthenticatedUser): void {
    const writeRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (activity.creatorId === actor.id) return;
    if (writeRoles.includes(actor.role)) return;
    throw new ForbiddenException(
      'CAL-FB-001: Only the creator, RP, or TI can modify this activity',
    );
  }
}

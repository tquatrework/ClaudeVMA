import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Calendar } from './entities/calendar.entity';
import { AvailabilitySlot, SlotKind, SlotRecurrence } from './entities/availability-slot.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ActivitiesService } from '../activities/activities.service';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../common/clients/profile-relations.client';
import {
  IdentityAccessClient,
  IdentityAccessUnavailableError,
} from '../common/clients/identity-access.client';
import {
  ProfileDisplayNameClient,
  ProfileDisplayNameUnavailableError,
} from '../common/clients/profile-display-name.client';
import {
  isCalendarBusyFreeAccessAllowed,
  resolveCalendarBusyFreeAccess,
} from './calendar-visibility.policy';
import { expandSlotToOccurrences, Occurrence } from './recurrence.util';

/**
 * Réponse pauvre de `GET /calendars/:ownerId/busy` — jamais d'id, de titre,
 * de type ni de participants. Voir `docs/routes.md`.
 */
export interface CalendarBusyFreeResponse {
  ownerId: string;
  from: string;
  to: string;
  availableWindows: Array<{ start: string; end: string }>;
  unavailableBlocks: Array<{ start: string; end: string }>;
  busyBlocks: Array<{ start: string; end: string }>;
}

/**
 * Une activité telle que portée par `GET /calendars/:ownerId` (chantier
 * calendrier de disponibilités, point 3 — gap comblé le 2026-08-18) : assez
 * d'information pour l'afficher directement dans la grille du calendrier du
 * titulaire, sans appel supplémentaire. `creatorName` est résolu ici, jamais
 * un `creatorId` brut affiché (arbitrage du 2026-08-09, « Affichage des
 * identifiants techniques ») — `null` uniquement si `profile-service` était
 * injoignable au moment de la lecture (dégradation gracieuse, voir
 * `ProfileDisplayNameClient`), jamais un UUID de repli.
 */
export interface CalendarActivityView {
  id: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  creatorId: string;
  creatorName: string | null;
  participantIds: string[];
}

/** Une semaine, en millisecondes — pas de dépendance date-fns côté backend. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fenêtre par défaut des activités portées par `GET /calendars/:ownerId`.
 * Aucune convention de fenêtre par défaut n'existait déjà dans ce service
 * (vérifié le 2026-08-18) — valeur proposée et documentée ici : 2 semaines
 * passées (pour retrouver un cours récent sans creuser l'historique complet)
 * + 4 semaines à venir (de quoi couvrir un mois de planification), sur le
 * modèle des bornes déjà utilisées par `GET /calendars/:ownerId/busy`
 * (fenêtre explicite `from`/`to`, ici implicite car cette route ne prend pas
 * de paramètres de fenêtre).
 */
const ACTIVITIES_WINDOW_PAST_MS = 2 * WEEK_MS;
const ACTIVITIES_WINDOW_FUTURE_MS = 4 * WEEK_MS;

@Injectable()
export class CalendarsService {
  constructor(
    @InjectRepository(Calendar)
    private readonly calendarRepo: Repository<Calendar>,
    @InjectRepository(AvailabilitySlot)
    private readonly slotRepo: Repository<AvailabilitySlot>,
    @InjectRepository(PaymentScheduleEntry)
    private readonly paymentRepo: Repository<PaymentScheduleEntry>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventsService: EventsService,
    private readonly activitiesService: ActivitiesService,
    private readonly profileRelationsClient: ProfileRelationsClient,
    private readonly identityAccessClient: IdentityAccessClient,
    private readonly profileDisplayNameClient: ProfileDisplayNameClient,
  ) {}

  /**
   * Get a calendar by ownerId, creating it lazily if it doesn't exist.
   * CAL-FB-001: requester must own the calendar or have RP/AP/TI privileges.
   *
   * Chantier calendrier de disponibilités, point 3 (gap comblé le
   * 2026-08-18) : porte désormais aussi les activités du titulaire
   * (`activities`) — créateur OU participant, `proposed`/`confirmed`,
   * fenêtre par défaut `[maintenant - 2 semaines, maintenant + 4 semaines)`
   * (voir `ACTIVITIES_WINDOW_PAST_MS`/`ACTIVITIES_WINDOW_FUTURE_MS`). C'est
   * la correction du gap déjà signalé : cette route promettait déjà
   * « créneaux de disponibilité + activités » dans sa propre documentation,
   * jamais tenu jusqu'ici — `activities` était toujours absent de la
   * réponse.
   */
  async getCalendar(
    ownerId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<Calendar & { paymentEntries?: PaymentScheduleEntry[]; activities: CalendarActivityView[] }> {
    this.assertCanReadCalendar(ownerId, actor);

    let calendar = await this.calendarRepo.findOne({
      where: { ownerId },
      relations: ['availabilitySlots'],
    });

    if (!calendar) {
      // Lazily create the calendar for this user
      calendar = await this.calendarRepo.save(
        this.calendarRepo.create({ ownerId, ownerRole: actor.role }),
      );
      calendar.availabilitySlots = [];
    }

    const activities = await this.buildActivitiesView(ownerId, correlationId);

    // For financeurs, also return payment schedule
    if (actor.role === UserRole.PARENT_FINANCEUR) {
      const paymentEntries = await this.paymentRepo.find({
        where: { ownerId },
        order: { dueDate: 'ASC' },
      });
      return { ...calendar, paymentEntries, activities };
    }

    return { ...calendar, activities };
  }

  /**
   * Construit la vue « activités » de `GET /calendars/:ownerId` : les
   * activités où `ownerId` est créateur ou participant, dans la fenêtre par
   * défaut, avec le nom du créateur résolu (jamais un `creatorId` brut
   * affiché — voir `CalendarActivityView`).
   *
   * Résolution du nom en lot (`ProfileDisplayNameClient.resolveDisplayNames`,
   * un seul appel HTTP pour tous les créateurs distincts de la fenêtre),
   * jamais un appel par activité. Dégradation gracieuse si `profile-service`
   * est injoignable : `creatorName: null` pour toutes les activités
   * concernées plutôt qu'un `503` sur une route de lecture centrale — voir
   * `ProfileDisplayNameUnavailableError`.
   */
  private async buildActivitiesView(
    ownerId: string,
    correlationId?: string,
  ): Promise<CalendarActivityView[]> {
    const now = Date.now();
    const from = new Date(now - ACTIVITIES_WINDOW_PAST_MS);
    const to = new Date(now + ACTIVITIES_WINDOW_FUTURE_MS);

    const activities = await this.activitiesService.findActiveInRange(ownerId, from, to);
    if (activities.length === 0) return [];

    const creatorIds = activities.map((activity) => activity.creatorId);
    let namesByCreatorId = new Map<string, { firstName: string | null; lastName: string | null }>();
    try {
      namesByCreatorId = await this.profileDisplayNameClient.resolveDisplayNames(
        creatorIds,
        correlationId,
      );
    } catch (error) {
      if (error instanceof ProfileDisplayNameUnavailableError) {
        // Dégradation gracieuse assumée : voir la doc de `buildActivitiesView`.
      } else {
        throw error;
      }
    }

    return activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      status: activity.status,
      startTime: activity.startTime.toISOString(),
      endTime: activity.endTime.toISOString(),
      creatorId: activity.creatorId,
      creatorName: formatDisplayName(namesByCreatorId.get(activity.creatorId)),
      participantIds: activity.participantIds,
    }));
  }

  /**
   * Replace availability slots for an owner (CAL-BR-001, CAL-BR-002).
   * CAL-FB-001: only the owner or RP/TI can update.
   * The lazy calendar creation, slot deletion and slot insertion are atomic
   * (single DataSource transaction / single EntityManager).
   */
  async updateAvailability(
    ownerId: string,
    dto: UpdateAvailabilityDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<Calendar> {
    this.assertCanWriteCalendar(ownerId, actor);

    let slotCount = 0;

    const calendar = await this.dataSource.transaction(async (manager) => {
      const calendarRepo = manager.getRepository(Calendar);
      const slotRepo = manager.getRepository(AvailabilitySlot);

      let existingCalendar = await calendarRepo.findOne({
        where: { ownerId },
        relations: ['availabilitySlots'],
      });

      if (!existingCalendar) {
        existingCalendar = await calendarRepo.save(
          calendarRepo.create({ ownerId, ownerRole: actor.role }),
        );
      }

      // Delete existing slots and replace with new ones
      await slotRepo.delete({ calendarId: existingCalendar.id });

      const newSlots = dto.slots.map((slotDto) =>
        slotRepo.create({
          calendarId: existingCalendar.id,
          dayOfWeek: slotDto.dayOfWeek ?? null,
          startTime: new Date(slotDto.startTime),
          endTime: new Date(slotDto.endTime),
          recurrence: slotDto.recurrence,
        }),
      );

      await slotRepo.save(newSlots);
      slotCount = newSlots.length;

      return calendarRepo.findOne({
        where: { ownerId },
        relations: ['availabilitySlots'],
      });
    });

    // Published after commit — the transaction above has already resolved.
    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotCount },
      correlationId,
    );

    return calendar;
  }

  /**
   * Create a single availability slot (CAL-BR-001/CAL-BR-002), without
   * touching any other existing slot — unlike `updateAvailability`, which
   * replaces the whole set.
   * CAL-FB-001: only the owner or RP/TI can write.
   */
  async createSlot(
    ownerId: string,
    dto: CreateAvailabilitySlotDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<AvailabilitySlot> {
    this.assertCanWriteCalendar(ownerId, actor);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const recurrenceEndDate = dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null;
    this.assertValidSlotTimes(startTime, endTime, recurrenceEndDate);

    const slot = await this.dataSource.transaction(async (manager) => {
      const calendarRepo = manager.getRepository(Calendar);
      const slotRepo = manager.getRepository(AvailabilitySlot);

      let calendar = await calendarRepo.findOne({ where: { ownerId } });
      if (!calendar) {
        calendar = await calendarRepo.save(
          calendarRepo.create({ ownerId, ownerRole: actor.role }),
        );
      }

      return slotRepo.save(
        slotRepo.create({
          calendarId: calendar.id,
          dayOfWeek: dto.dayOfWeek ?? null,
          startTime,
          endTime,
          recurrence: dto.recurrence ?? SlotRecurrence.NONE,
          recurrenceEndDate,
          kind: dto.kind ?? SlotKind.AVAILABLE,
        }),
      );
    });

    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotId: slot.id, action: 'created' },
      correlationId,
    );

    return slot;
  }

  /**
   * Update a single availability slot: resize (startTime/endTime), change
   * recurrence/end date/kind. Scoped to `ownerId` — a `slotId` that exists
   * but belongs to a different owner's calendar is treated as not found,
   * never modified and never revealed.
   * CAL-FB-001: only the owner or RP/TI can write.
   */
  async updateSlot(
    ownerId: string,
    slotId: string,
    dto: UpdateAvailabilitySlotDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<AvailabilitySlot> {
    this.assertCanWriteCalendar(ownerId, actor);

    const slot = await this.findSlotOrFail(ownerId, slotId);

    const startTime = dto.startTime ? new Date(dto.startTime) : slot.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : slot.endTime;
    const recurrenceEndDate =
      dto.recurrenceEndDate === undefined
        ? slot.recurrenceEndDate
        : dto.recurrenceEndDate === null
          ? null
          : new Date(dto.recurrenceEndDate);
    this.assertValidSlotTimes(startTime, endTime, recurrenceEndDate);

    const updated = await this.slotRepo.save({
      ...slot,
      dayOfWeek: dto.dayOfWeek ?? slot.dayOfWeek,
      startTime,
      endTime,
      recurrence: dto.recurrence ?? slot.recurrence,
      recurrenceEndDate,
      kind: dto.kind ?? slot.kind,
    });

    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotId: updated.id, action: 'updated' },
      correlationId,
    );

    return updated;
  }

  /**
   * Delete a single availability slot. Hard delete — consistent with the
   * existing bulk-replace behaviour of `updateAvailability`, which already
   * deletes and recreates slots wholesale; this is operational scheduling
   * data, not a record with probative/audit value.
   * CAL-FB-001: only the owner or RP/TI can write.
   */
  async deleteSlot(
    ownerId: string,
    slotId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<void> {
    this.assertCanWriteCalendar(ownerId, actor);

    const slot = await this.findSlotOrFail(ownerId, slotId);
    await this.slotRepo.delete({ id: slot.id });

    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotId: slot.id, action: 'deleted' },
      correlationId,
    );
  }

  /**
   * `GET /calendars/:ownerId/busy?from=&to=` — busy/free d'un tiers, piloté
   * par la relation métier réelle (point 2 du chantier calendrier de
   * disponibilités). Réponse volontairement pauvre : jamais d'id, de titre,
   * de type ni de participants — voir `CalendarBusyFreeResponse`.
   *
   * Contrôle d'accès AVANT toute lecture en base, comme partout ailleurs
   * dans ce projet : une requête refusée ne doit pas même toucher les
   * données qu'elle n'a pas le droit de voir.
   *
   * `403` (pas `404`) en cas de refus — recommandation retenue à
   * l'approbation du plan : contrairement aux archives/statistiques
   * pédagogiques, il n'y a ici aucune ambiguïté d'existence à protéger, le
   * calendrier existe toujours.
   *
   * `503` si `profile-service` est injoignable — échec fermé, jamais un
   * accès accordé par défaut (`ProfileRelationsUnavailableError`).
   *
   * `ownerRole` (nécessaire à `resolveCalendarBusyFreeAccess` pour un
   * titulaire élève vs formateur) est résolu auprès d'`identity-access-service`
   * (`IdentityAccessClient`), jamais lu depuis `Calendar.ownerRole` : cette
   * colonne n'existe que si la ligne `Calendar` a déjà été créée
   * paresseusement par un appel antérieur, ce qui n'est pas garanti pour un
   * titulaire qui n'a encore jamais ouvert son propre calendrier — bug
   * corrigé (CAL-FB-004), voir `IdentityAccessClient`. `503` si
   * `identity-access-service` est injoignable, même posture d'échec fermé
   * que pour `profile-service`.
   */
  async getBusyFree(
    ownerId: string,
    actor: AuthenticatedUser,
    from: Date,
    to: Date,
    correlationId?: string,
  ): Promise<CalendarBusyFreeResponse> {
    if (to.getTime() <= from.getTime()) {
      throw new BadRequestException('to must be after from');
    }

    if (actor.id !== ownerId) {
      let ownerRole: string | undefined;
      try {
        ownerRole = await this.identityAccessClient.resolveRole(ownerId, correlationId);
      } catch (error) {
        if (error instanceof IdentityAccessUnavailableError) {
          throw new ServiceUnavailableException(
            "Impossible de vérifier les droits d'accès à ce calendrier pour le moment. " +
              'Réessayez dans un instant.',
          );
        }
        throw error;
      }

      let snapshot;
      try {
        snapshot = await this.profileRelationsClient.resolveRelations(
          actor.id,
          ownerId,
          actor.role,
          correlationId,
        );
      } catch (error) {
        if (error instanceof ProfileRelationsUnavailableError) {
          throw new ServiceUnavailableException(
            "Impossible de vérifier les droits d'accès à ce calendrier pour le moment. " +
              'Réessayez dans un instant.',
          );
        }
        throw error;
      }

      const position = resolveCalendarBusyFreeAccess({
        viewerId: actor.id,
        viewerRole: actor.role,
        ownerId,
        ownerRole,
        relations: snapshot.relations,
      });

      if (!isCalendarBusyFreeAccessAllowed(position)) {
        throw new ForbiddenException(
          "CAL-FB-004: You may only read the busy/free calendar of a person you're linked to",
        );
      }
    }

    const calendar = await this.calendarRepo.findOne({
      where: { ownerId },
      relations: ['availabilitySlots'],
    });

    const slots = calendar?.availabilitySlots ?? [];
    const availableWindows: Occurrence[] = [];
    const unavailableBlocks: Occurrence[] = [];

    for (const slot of slots) {
      const occurrences = expandSlotToOccurrences(slot, from, to);
      if (slot.kind === SlotKind.UNAVAILABLE) {
        unavailableBlocks.push(...occurrences);
      } else {
        availableWindows.push(...occurrences);
      }
    }

    const activities = await this.activitiesService.findActiveInRange(ownerId, from, to);
    const busyBlocks = activities.map((activity) => ({
      start: activity.startTime,
      end: activity.endTime,
    }));

    return {
      ownerId,
      from: from.toISOString(),
      to: to.toISOString(),
      availableWindows: toIsoOccurrences(availableWindows),
      unavailableBlocks: toIsoOccurrences(unavailableBlocks),
      busyBlocks: toIsoOccurrences(busyBlocks),
    };
  }

  // ---- Slot helpers ----

  /**
   * Loads a slot scoped to its owner's calendar. A `slotId` that exists but
   * belongs to another owner's calendar is treated exactly like an unknown
   * slot — no existence leak (same posture as other masking rules in this
   * project).
   */
  private async findSlotOrFail(ownerId: string, slotId: string): Promise<AvailabilitySlot> {
    const slot = await this.slotRepo
      .createQueryBuilder('slot')
      .innerJoin('slot.calendar', 'calendar')
      .where('slot.id = :slotId', { slotId })
      .andWhere('calendar.owner_id = :ownerId', { ownerId })
      .getOne();

    if (!slot) {
      throw new NotFoundException(`Availability slot ${slotId} not found`);
    }
    return slot;
  }

  private assertValidSlotTimes(
    startTime: Date,
    endTime: Date,
    recurrenceEndDate: Date | null,
  ): void {
    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (recurrenceEndDate && recurrenceEndDate.getTime() < startTime.getTime()) {
      throw new BadRequestException('recurrenceEndDate must not be before startTime');
    }
  }

  // ---- Access control helpers ----

  /**
   * CAL-FB-001: Read access — owner or internal roles (RP, TI, FINANCE_ADMIN).
   *
   * `ANIMATEUR_PEDAGOGIQUE` retiré le 2026-08-18 (chantier calendrier de
   * disponibilités, point 2) : il donnait jusqu'ici un accès INTÉGRAL à
   * n'importe quel calendrier, sans aucune vérification de lien — contredisant
   * directement le principe même de la visibilité busy/free pilotée par
   * relation. L'AP passe désormais exclusivement par
   * `GET /calendars/:ownerId/busy`, qui vérifie la relation réelle
   * (`ANIMATOR_OF_TEACHER`) via `profile-service`.
   */
  private assertCanReadCalendar(ownerId: string, actor: AuthenticatedUser): void {
    const internalRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (actor.id === ownerId) return;
    if (internalRoles.includes(actor.role)) return;
    throw new ForbiddenException(
      'CAL-FB-001: You may only read your own calendar unless you have an internal role',
    );
  }

  /**
   * CAL-FB-001: Write access — only the owner or RP/TI can modify a calendar.
   */
  private assertCanWriteCalendar(ownerId: string, actor: AuthenticatedUser): void {
    const writeRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (actor.id === ownerId) return;
    if (writeRoles.includes(actor.role)) return;
    throw new ForbiddenException(
      'CAL-FB-001: You may only modify your own calendar',
    );
  }
}

/**
 * Compose « Prénom Nom » à partir du résultat de `ProfileDisplayNameClient`.
 * `undefined` (créateur absent de la réponse en lot) ou deux champs `null`
 * renvoient `null` — jamais une chaîne vide ni l'identifiant technique.
 */
function formatDisplayName(
  name: { firstName: string | null; lastName: string | null } | undefined,
): string | null {
  if (!name) return null;
  const parts = [name.firstName, name.lastName].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Sérialise une liste d'occurrences (`Date`) en ISO 8601, pour la réponse HTTP. */
function toIsoOccurrences(
  occurrences: Array<{ start: Date; end: Date }>,
): Array<{ start: string; end: string }> {
  return occurrences.map((occurrence) => ({
    start: occurrence.start.toISOString(),
    end: occurrence.end.toISOString(),
  }));
}

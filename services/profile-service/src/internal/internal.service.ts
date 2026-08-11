import { Injectable } from '@nestjs/common';
import { ProfilesService } from '../profiles/profiles.service';
import { RelationsService } from '../relations/relations.service';
import { isAdministrator } from '../relations/pedagogical-access.policy';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * System-to-system adapter consumed by orchestration-service during account
 * onboarding (student, teacher, parent, coordinator bootstrap). It owns no
 * entity: every write goes through ProfilesService or RelationsService, the
 * modules that actually own the underlying data (modules-convention:
 * "une feature n'injecte jamais directement le repository d'une entité
 * possédée par une autre feature").
 *
 * Authorization for this whole module is enforced once at the HTTP boundary
 * by InternalGuard (X-Internal-Secret) — individual methods below do not take
 * an Actor because there is no human actor for a system-triggered bootstrap.
 *
 * Naming (arbitrage du 2026-08-08, docs/architecture.md > "Arbitrages rendus") :
 * une même donnée porte un seul nom dans tout le système. Les blocs de profil
 * s'appellent `administrative` / `pedagogical` PARTOUT — routes publiques comme
 * routes `/internal/*`. La paire longue `administrativeProfile`/
 * `pedagogicalProfile` que renvoyaient auparavant ces routes a été supprimée
 * sans alias de compatibilité : un alias recréerait exactement la divergence
 * que l'arbitrage résorbe.
 */
@Injectable()
export class InternalService {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly relationsService: RelationsService,
  ) {}

  /**
   * Upsert du profil administratif, puis PROJECTION vers la forme exposée.
   *
   * La projection n'est pas cosmétique : elle écarte les champs de stockage de
   * la photo (`avatarObjectKey`, `avatarContentType`) et construit `avatarUrl`.
   * Les routes `/internal/*` passent par le même projecteur que les routes
   * publiques — une donnée porte un seul nom et une seule forme partout
   * (`docs/architecture.md`, arbitrage du 2026-08-08).
   */
  private async bootstrapAndPresentAdministrativeProfile(dto: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
  }) {
    const profile = await this.profilesService.bootstrapAdministrativeProfile(dto);
    return this.profilesService.presentAdministrativeProfile(profile);
  }

  async createAdministrativeProfile(dto: {
    userId: string;
    firstName: string;
    lastName: string;
    phone?: string;
    birthDate?: string;
  }) {
    const administrative = await this.bootstrapAndPresentAdministrativeProfile(dto);
    return { userId: dto.userId, administrative };
  }

  async createStudentProfiles(dto: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
    level?: string;
  }) {
    const administrative = await this.bootstrapAndPresentAdministrativeProfile(dto);
    const pedagogical = await this.profilesService.bootstrapStudentPedagogicalProfile(dto);

    return {
      userId: dto.userId,
      administrative,
      pedagogical,
    };
  }

  async createTeacherProfiles(dto: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    subjects?: string[];
    levels?: string[];
    bio?: string;
  }) {
    const administrative = await this.bootstrapAndPresentAdministrativeProfile(dto);
    const pedagogical = await this.profilesService.bootstrapTeacherPedagogicalProfile(dto);

    return {
      userId: dto.userId,
      administrative,
      pedagogical,
    };
  }

  async linkParent(dto: { studentId: string; financeOwnerId: string }) {
    await this.relationsService.createFinanceOwnerStudentLinkForSystem(
      dto.financeOwnerId,
      dto.studentId,
    );
    return { linked: true, contacts: [dto.financeOwnerId] };
  }

  async createTeacherStudentRelation(dto: {
    teacherId: string;
    studentId: string;
    isPrincipalTeacher?: boolean;
  }) {
    const saved = await this.relationsService.createTeacherStudentLinkForSystem(
      dto.teacherId,
      dto.studentId,
      dto.isPrincipalTeacher ?? false,
    );
    return { teacherId: saved.teacherId, studentId: saved.studentId, isPrincipalTeacher: saved.isPrincipalTeacher };
  }

  async linkCoordinator(dto: {
    coordinatorId: string;
    studentId: string;
    coordinatorRole: string;
  }) {
    const saved = await this.relationsService.createPedagogicalCoordinatorLinkForSystem(
      dto.coordinatorId,
      dto.studentId,
      dto.coordinatorRole,
    );
    return {
      coordinatorId: saved.coordinatorId,
      studentId: saved.studentId,
      coordinatorRole: saved.coordinatorRole,
    };
  }

  /**
   * LECTURE de la relation entre deux personnes, pour un service appelant.
   *
   * `profile-service` reste l'unique propriétaire des relations : les autres
   * services les lui demandent, ils n'en tiennent jamais de copie (arbitrage du
   * 2026-08-11, point 4). Premier consommateur : `archive-document-service`, qui
   * doit appliquer la même règle aux archives pédagogiques.
   *
   * La réponse est SUFFISANTE POUR DÉCIDER, et pas seulement pour savoir s'il y
   * a un lien : elle donne la NATURE et le SENS de chaque relation. Les droits
   * en dépendent — un élève voit les statistiques de son formateur mais PAS ses
   * archives pédagogiques (l'archive d'un formateur porte son historique
   * d'exercice, elle ne regarde pas ses élèves). Un booléen aurait rendu cette
   * distinction impossible à faire côté appelant.
   *
   * Ce service ne rend PAS le verdict à la place de l'appelant : chaque service
   * propriétaire décide de sa propre surface. Il fournit les faits — relations,
   * identité, qualité d'administrateur — pas la conclusion.
   */
  async resolveRelation(viewerId: string, targetId: string, viewerRole: UserRole) {
    const isSelf = viewerId === targetId;
    return {
      viewerId,
      targetId,
      isSelf,
      isAdministrator: isAdministrator(viewerRole),
      relations: isSelf ? [] : await this.relationsService.resolveRelations(viewerId, targetId),
    };
  }
}

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProfilesService } from '../profiles/profiles.service';
import { RelationsService } from '../relations/relations.service';
import { AdministrativeProfileLookupService } from '../profiles/administrative-profile-lookup.service';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
} from '../common/clients/identity-access.client';
import { isAdministrator } from '../relations/pedagogical-access.policy';
import { UserRole } from '../common/enums/user-role.enum';
import { DisplayName, DisplayNameBatch } from './display-name';

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
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly profilesService: ProfilesService,
    private readonly relationsService: RelationsService,
    private readonly administrativeProfileLookup: AdministrativeProfileLookupService,
    private readonly identityAccessClient: IdentityAccessClient,
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

  /**
   * Crée le lien élève↔formateur, dont `profile-service` est l'unique
   * propriétaire (arbitrage du 2026-08-12, point 5). Appelée par
   * `teacher-request-service` quand le RP valide l'acceptation d'un formateur.
   *
   * L'opération est IDEMPOTENTE : `isCreated` distingue la création du rejeu,
   * et c'est le contrôleur qui en tire le code HTTP (201 / 200). Le corps de
   * réponse est identique dans les deux cas — l'appelant a obtenu ce qu'il
   * demandait, le lien existe.
   *
   * Ce lien n'est pas anodin : il ouvre des droits de LECTURE réels
   * (statistiques et archives pédagogiques, arbitrage du 2026-08-11). Il passe
   * donc par RelationsService, propriétaire de la donnée, comme toutes les
   * autres créations de relation — rien n'écrit `teacher_student_links` en
   * dehors de lui.
   */
  async createTeacherStudentRelation(dto: {
    teacherId: string;
    studentId: string;
    isPrincipalTeacher?: boolean;
  }): Promise<{
    isCreated: boolean;
    relation: { teacherId: string; studentId: string; isPrincipalTeacher: boolean };
  }> {
    const { link, isCreated } = await this.relationsService.ensureTeacherStudentLinkForSystem(
      dto.teacherId,
      dto.studentId,
      dto.isPrincipalTeacher ?? false,
    );
    return {
      isCreated,
      relation: {
        teacherId: link.teacherId,
        studentId: link.studentId,
        isPrincipalTeacher: link.isPrincipalTeacher,
      },
    };
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
  /**
   * RÉSOLUTION DE NOM pour un service appelant — prénom et nom, RIEN D'AUTRE.
   *
   * Servie sans lecteur et sans filtrage champ par champ (arbitrage du
   * 2026-08-12) : le formateur destinataire d'une proposition n'est encore lié
   * à aucun élève, la route publique lui répondrait `403` et l'écran
   * afficherait un UUID. Cette route est le seul endroit du service où une
   * identité sort sans contrôle de lecteur — d'où son périmètre volontairement
   * minuscule et NON EXTENSIBLE (voir `display-name.ts`).
   *
   * Absence de profil administratif : traitée exactement comme sur
   * `GET /profiles/:userId` (arbitrage du 2026-08-07). Un `userId` inconnu de
   * `identity-access-service` donne `404` ; un compte connu SANS profil
   * administratif est une incohérence de données et donne `500`, jamais un
   * nom vide qui masquerait l'anomalie.
   *
   * `correlationId` est propagé à `identity-access-service` quand l'appelant
   * en fournit un.
   */
  async resolveDisplayName(userId: string, correlationId?: string): Promise<DisplayName> {
    const namesByUserId = await this.administrativeProfileLookup.findNamesByUserIds([userId]);
    const name = namesByUserId.get(userId);
    if (!name) {
      throw await this.missingAdministrativeProfileError(userId, correlationId);
    }
    return { userId, firstName: name.firstName, lastName: name.lastName };
  }

  /**
   * Variante PAR LOT, pour qu'une liste de N lignes ne coûte pas N appels HTTP
   * (une seule requête SQL, cf. AdministrativeProfileLookupService).
   *
   * Différence assumée avec la route unitaire : un `userId` sans profil
   * administratif est ABSENT de la réponse au lieu de faire échouer le lot. Un
   * seul identifiant douteux ne doit pas priver l'appelant de tous les autres
   * noms — il retombera sur son propre repli pour celui-là. L'anomalie reste
   * visible côté serveur par un log explicite, elle n'est pas silencieuse.
   * L'ordre d'entrée est conservé, les doublons sont réduits à une entrée.
   */
  async resolveDisplayNames(userIds: string[]): Promise<DisplayNameBatch> {
    const namesByUserId = await this.administrativeProfileLookup.findNamesByUserIds(userIds);
    const distinctUserIds = [...new Set(userIds)];

    const unresolvedUserIds = distinctUserIds.filter((userId) => !namesByUserId.has(userId));
    if (unresolvedUserIds.length > 0) {
      this.logger.warn(
        `Résolution de noms par lot : aucun profil administratif pour ${unresolvedUserIds.length} ` +
          `identifiant(s) sur ${distinctUserIds.length} (${unresolvedUserIds.join(', ')}). ` +
          "Ces identifiants sont absents de la réponse. Si le compte existe côté " +
          'identity-access-service, il s\'agit d\'une incohérence de données à corriger à la source.',
      );
    }

    const displayNames = distinctUserIds
      .filter((userId) => namesByUserId.has(userId))
      .map((userId) => {
        const name = namesByUserId.get(userId) as { firstName: string | null; lastName: string | null };
        return { userId, firstName: name.firstName, lastName: name.lastName };
      });

    return { displayNames };
  }

  /**
   * Construit l'erreur levée quand aucun profil administratif ne porte ce
   * `userId`, en distinguant les deux causes possibles — c'est la même règle
   * que sur la route publique, appliquée ici avec un seul appel sortant, fait
   * UNIQUEMENT sur ce chemin d'erreur (le cas nominal ne sort pas du service).
   *
   *  - compte inconnu de `identity-access-service` → `404` ;
   *  - compte connu mais sans profil administratif → `500` (incohérence de
   *    données : le profil administratif est obligatoire et créé à
   *    l'inscription) ;
   *  - `identity-access-service` injoignable → `500` également : impossible de
   *    distinguer les deux, et un `404` ferait passer tous les profils de la
   *    plateforme pour supprimés le temps d'une panne.
   */
  private async missingAdministrativeProfileError(
    userId: string,
    correlationId?: string,
  ): Promise<NotFoundException | InternalServerErrorException> {
    try {
      const account = await this.identityAccessClient.findAccountByUserId(userId, correlationId);
      this.logger.error(
        `ANOMALIE DE DONNEES : le compte userId=${userId} existe dans identity-access-service ` +
          `(loginIdentifier=${account.loginIdentifier}) mais n'a aucun profil administratif dans ` +
          'profile-service. Résolution de nom impossible ; corriger la donnée à la source.',
      );
      return new InternalServerErrorException(
        `Profil administratif introuvable pour userId=${userId}`,
      );
    } catch (error) {
      if (error instanceof IdentityAccessNotFoundError) {
        return new NotFoundException(
          `Aucun compte connu de identity-access-service pour userId=${userId}`,
        );
      }
      this.logger.error(
        `Résolution de nom impossible pour userId=${userId} : aucun profil administratif en base et ` +
          "identity-access-service injoignable, donc impossible de distinguer un compte inexistant " +
          `d'une incohérence de données. Réponse 500. (${(error as Error).message})`,
      );
      return new InternalServerErrorException(
        `Résolution de nom impossible pour userId=${userId}`,
      );
    }
  }

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

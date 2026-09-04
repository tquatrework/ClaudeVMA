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

  /**
   * Création du profil administratif à l'inscription — TOUS RÔLES CONFONDUS.
   *
   * C'est par ICI que passe réellement `POST /accounts/teachers` : mesuré
   * contre la pile le 2026-08-12, identity-access-service appelle cette route,
   * et NON `create-teacher-profiles` (qui sert le workflow orchestré). C'est la
   * raison pour laquelle l'enregistrement de validation d'un formateur doit
   * être créé ici aussi, sans quoi la correction ne vaudrait que pour un chemin
   * que l'inscription réelle n'emprunte pas.
   *
   * `role` est OPTIONNEL et son absence n'est pas une erreur : rien n'est
   * deviné, on ne crée un enregistrement de validation que si l'appelant a
   * explicitement annoncé un formateur. `profile-service` ne persiste pas ce
   * rôle et ne l'expose pas — identity-access-service en reste l'unique
   * propriétaire (arbitrage du 2026-08-07) ; il ne sert ici qu'à initialiser la
   * structure qui revient à ce service.
   */
  async createAdministrativeProfile(dto: {
    userId: string;
    firstName: string;
    lastName: string;
    phone?: string;
    birthDate?: string;
    role?: UserRole;
  }) {
    const administrative = await this.bootstrapAndPresentAdministrativeProfile(dto);

    if (dto.role === UserRole.FORMATEUR) {
      await this.profilesService.bootstrapTeacherValidation(dto.userId);
    } else if (dto.role === undefined) {
      this.logger.warn(
        `Profil administratif créé pour userId=${dto.userId} SANS rôle transmis. Le rôle doit ` +
          'accompagner systématiquement les appels interservices (arbitrage du 2026-08-07). ' +
          "Conséquence concrète si ce compte est un formateur : aucun enregistrement de " +
          "validation n'est créé, il n'apparaîtra dans aucune file du responsable pédagogique " +
          'et ne sera donc jamais validé.',
      );
    }

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

  /**
   * Profils initiaux d'un formateur — chemin du workflow orchestré
   * `teacher-onboarding`.
   *
   * Ici le rôle n'a pas à être transmis : la route elle-même dit que le compte
   * est un formateur. L'enregistrement de validation est donc créé
   * INCONDITIONNELLEMENT, au statut `pending` (arbitrage du 2026-08-12).
   *
   * `validation` figure dans la réponse pour que l'appelant puisse constater ce
   * qui a été créé plutôt que de le supposer — on renvoie l'état enregistré, pas
   * le corps reçu (règle du 2026-08-10, point 3bis). L'ajout est sans risque
   * pour les consommateurs actuels : identity-access-service ne lit que le code
   * HTTP de ces routes.
   */
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
    const { validation } = await this.profilesService.bootstrapTeacherValidation(dto.userId);

    return {
      userId: dto.userId,
      administrative,
      pedagogical,
      validation,
    };
  }

  /**
   * REPRISE DE STOCK des formateurs inscrits AVANT le 2026-08-12, qui n'ont
   * aucun enregistrement de validation et sont donc invisibles du responsable
   * pédagogique (arbitrage du 2026-08-12, point 3 : « les formateurs déjà
   * inscrits doivent être rattrapés »).
   *
   * POURQUOI UNE ROUTE ET NON UNE MIGRATION SQL. `profile-service` ne connaît
   * pas les rôles — identity-access-service en est l'unique propriétaire
   * (arbitrage du 2026-08-07) et aucune table locale ne dit qui est formateur.
   * `teacher_pedagogical_profiles` ne peut pas en tenir lieu : mesuré contre la
   * pile le 2026-08-12, 17 formateurs existent pour 5 lignes dans cette table,
   * et les deux formateurs `validated` n'y figurent même pas. Une migration SQL
   * ne pourrait donc que deviner, c'est-à-dire créer des enregistrements de
   * validation pour des élèves et des parents. La liste des formateurs est
   * demandée à son propriétaire, par
   * `scripts/maintenance/backfill-teacher-validations.ts`.
   *
   * IDEMPOTENTE ET NON DESTRUCTRICE : un formateur déjà `validated` ou
   * `rejected` est laissé strictement intact et compté dans `alreadyPresent`.
   * Rejouer le script autant de fois qu'on veut ne change rien après le premier
   * passage.
   */
  async ensureTeacherValidations(teacherIds: string[]): Promise<{
    created: string[];
    alreadyPresent: string[];
  }> {
    const created: string[] = [];
    const alreadyPresent: string[] = [];

    for (const teacherId of [...new Set(teacherIds)]) {
      const { isCreated } = await this.profilesService.bootstrapTeacherValidation(teacherId);
      if (isCreated) {
        created.push(teacherId);
      } else {
        alreadyPresent.push(teacherId);
      }
    }

    this.logger.log(
      `Reprise de stock des enregistrements de validation : ${created.length} créé(s), ` +
        `${alreadyPresent.length} déjà présent(s) et laissé(s) intact(s).`,
    );
    return { created, alreadyPresent };
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

  /**
   * LECTURE des parents financeurs d'un élève, POUR UN APPEL INTERSERVICES —
   * arbitrage du 2026-08-14 (`docs/architecture.md` > « Systeme de
   * notifications transversal », point 5).
   *
   * Premier consommateur : `dashboard-notification-service`, qui doit pouvoir
   * notifier les parents financeurs d'un élève (ex. professeur validé pour cet
   * élève) sans détenir de jeton utilisateur humain — `RelationsService`
   * n'était accessible que via `GET /relations/finance-owner-student/by-student/:studentId`,
   * protégée par `JwtAuthGuard`.
   *
   * RÉUTILISE `RelationsService.getFinanceOwnersByStudent`, propriétaire de la
   * donnée et de sa logique de sélection (liens actifs uniquement), au lieu de
   * la dupliquer. Cette méthode exige un `Actor` pour son contrôle de droit
   * humain (self ou rôle privilégié) : comme il n'y a ici aucun acteur humain,
   * l'appel est fait avec un acteur système portant un rôle privilégié
   * (`RESPONSABLE_PEDAGOGIQUE`) — l'autorisation réelle de cette route est déjà
   * tranchée en amont par `InternalGuard` (X-Internal-Secret), au même titre
   * que les autres routes `/internal/*`.
   *
   * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : ne renvoie que les `userId`, jamais les
   * noms ni le statut du lien — la résolution de nom passe par la route dédiée
   * `GET /internal/profiles/:userId/display-name` / `POST /internal/profiles/display-names`,
   * séparément.
   */
  async getFinanceOwnersByStudent(studentId: string): Promise<{
    studentId: string;
    financeOwnerUserIds: string[];
  }> {
    const links = await this.relationsService.getFinanceOwnersByStudent(
      studentId,
      INTERNAL_SYSTEM_ACTOR,
    );
    return {
      studentId,
      financeOwnerUserIds: links.map((link) => link.financeOwnerId),
    };
  }

  /**
   * LECTURE des professeurs ACTIFS d'un élève, POUR UN APPEL INTERSERVICES —
   * même patron que `getFinanceOwnersByStudent` ci-dessus (arbitrage du
   * 2026-09-01, chantier refonte des Evaluations : demande de correction
   * humaine). Premier consommateur : `learning-activity-service`, qui doit
   * notifier les professeurs de l'élève quand celui-ci demande une correction,
   * sans détenir de jeton utilisateur humain.
   *
   * RÉUTILISE `RelationsService.getTeachersByStudent`, propriétaire de la
   * donnée et de sa logique de sélection (liens ACTIFS uniquement, un
   * professeur délié n'apparaît plus), au lieu de la dupliquer. Même acteur
   * système que `getFinanceOwnersByStudent` : l'autorisation réelle de cette
   * route est déjà tranchée en amont par `InternalGuard` (X-Internal-Secret).
   *
   * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : ne renvoie que les `userId`, jamais les
   * noms — la résolution de nom passe par `GET /internal/profiles/:userId/display-name` /
   * `POST /internal/profiles/display-names`, séparément.
   */
  async getTeachersByStudent(studentId: string): Promise<{
    studentId: string;
    teacherUserIds: string[];
  }> {
    const links = await this.relationsService.getTeachersByStudent(
      studentId,
      INTERNAL_SYSTEM_ACTOR,
    );
    return {
      studentId,
      teacherUserIds: links.map((link) => link.teacherId),
    };
  }

  /**
   * `GET /internal/profiles/search-by-name` — recherche composite par nom
   * pour la fonctionnalité Contacts de `communication-service` (arbitrage du
   * 2026-09-04, `docs/architecture/contacts-messagerie.md`, points 2 et 11).
   *
   * OUVERTE À TOUT UTILISATEUR CONNECTÉ, SANS RESTRICTION DE RÔLE SUR
   * L'APPELANT NI SUR LA CIBLE — à la différence de l'annuaire
   * `GET /profiles/directory/by-role`, réservé aux rôles administratifs.
   * `communication-service` appelle cette route pour le compte de
   * N'IMPORTE QUEL utilisateur cherchant N'IMPORTE QUEL autre utilisateur ;
   * l'autorisation réelle de la route est déjà tranchée en amont par
   * `InternalGuard` (X-Internal-Secret), pas par un rôle transporté ici.
   *
   * COMPOSITION ENTRE DEUX SERVICES, PAS DE DUPLICATION : le nom
   * (`firstName`/`lastName`) appartient à `profile-service`, l'identifiant de
   * connexion (`loginIdentifier`) à `identity-access-service` (arbitrage du
   * 2026-08-06). Même mécanisme dans l'esprit que `GET /profiles/directory`,
   * qui compose déjà les deux — ici sans restriction de rôle.
   *
   * ZÉRO RÉSULTAT EST UN CAS NORMAL, PAS UNE ANOMALIE : l'utilisateur qui a
   * demandé ce chantier a explicitement prévenu que « tous les noms ne
   * seront pas connus » (arbitrage du 2026-09-04, point 10) — aucune erreur
   * n'est levée sur une recherche infructueuse.
   *
   * DÉGRADATION GRACIEUSE PAR RÉSULTAT : un profil administratif dont le
   * `loginIdentifier` ne peut pas être résolu auprès de
   * `identity-access-service` (compte supprimé côté identity-access-service,
   * panne réseau ponctuelle) est SIMPLEMENT ABSENT de la réponse plutôt que
   * de faire échouer toute la recherche — même politique que
   * `resolveDisplayNames` ci-dessus : un identifiant douteux ne prive pas
   * l'appelant des autres résultats.
   */
  async searchByName(q: string): Promise<{
    results: { userId: string; firstName: string | null; lastName: string | null; loginIdentifier: string }[];
  }> {
    const profiles = await this.administrativeProfileLookup.searchByName(q, SEARCH_BY_NAME_LIMIT);
    if (profiles.length === 0) {
      return { results: [] };
    }

    const accounts = await Promise.allSettled(
      profiles.map((profile) => this.identityAccessClient.findAccountByUserId(profile.userId)),
    );

    const results: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      loginIdentifier: string;
    }[] = [];

    profiles.forEach((profile, index) => {
      const outcome = accounts[index];
      if (outcome.status === 'rejected') {
        this.logger.warn(
          `Recherche par nom : impossible de résoudre le loginIdentifier de userId=${profile.userId} ` +
            `auprès de identity-access-service (${outcome.reason}). Résultat écarté plutôt que de ` +
            'faire échouer toute la recherche.',
        );
        return;
      }
      results.push({
        userId: profile.userId,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        loginIdentifier: outcome.value.loginIdentifier,
      });
    });

    return { results };
  }
}

/**
 * Plafond de résultats de `GET /internal/profiles/search-by-name` — aucune
 * pagination stricte n'est demandée pour cet usage (arbitrage du
 * 2026-09-04), mais un plafond non déclaré serait un plafond caché (règle du
 * 2026-08-10/2026-08-12) : la route doit rester bornée dès l'origine.
 */
const SEARCH_BY_NAME_LIMIT = 20;

/**
 * Acteur synthétique utilisé UNIQUEMENT pour satisfaire la signature `Actor`
 * de méthodes de `RelationsService` réutilisées par des routes `/internal/*`
 * sans acteur humain. `id` n'a aucune signification (aucun `studentId` ne
 * peut jamais l'égaler par construction, un UUID nul n'étant attribué à
 * personne) ; `role` est privilégié pour que le contrôle de droit interne à
 * `RelationsService` s'efface — l'autorisation réelle est celle
 * d'`InternalGuard`, en amont.
 */
const INTERNAL_SYSTEM_ACTOR: { id: string; role: UserRole } = {
  id: '00000000-0000-0000-0000-000000000000',
  role: UserRole.RESPONSABLE_PEDAGOGIQUE,
};

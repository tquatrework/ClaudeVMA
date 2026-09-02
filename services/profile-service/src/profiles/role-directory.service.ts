import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from './entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import { TeacherDirectoryService } from './teacher-directory.service';
import { Actor } from '../common/types/actor.type';
import { UserRole } from '../common/enums/user-role.enum';
import { isAdministrator } from '../relations/pedagogical-access.policy';
import {
  IdentityAccessClient,
  IdentityAccessUnavailableError,
} from '../common/clients/identity-access.client';
import {
  DirectoryRole,
  RoleDirectoryPageQueryDto,
  DIRECTORY_PAGE_DEFAULT_LIMIT,
  DIRECTORY_PAGE_DEFAULT_PAGE,
} from './dto/role-directory-page.query.dto';
import { DEFAULT_AVATAR_PUBLIC_PATH_PREFIX, buildAvatarUrl } from './administrative-profile.view';

/**
 * ANNUAIRE « VISUALISATION » DU RP — arbitrage du 2026-09-02
 * (`docs/architecture.md`, « Reconstruction du rail gauche du RP », précision
 * après PR #207).
 *
 * Une seule route, `GET /profiles/directory?role=`, couvrant les 4 rôles que
 * le RP doit pouvoir retrouver (élève, parent financeur, formateur, animateur
 * pédagogique) sous forme de tuiles. Le rôle `formateur` DÉLÈGUE entièrement
 * à `TeacherDirectoryService.listValidatedTeachers` plutôt que de dupliquer
 * sa logique : c'est le même « annuaire des formateurs validés » que
 * l'arbitrage du 2026-08-12 avait déjà construit pour l'étape 3 du flow
 * demande de professeur, et l'arbitrage du 2026-09-02 demande explicitement
 * de le RÉUTILISER pour cet usage plutôt que d'en bâtir un distinct.
 *
 * POURQUOI PAS `teacher_validations` POUR LES 3 AUTRES RÔLES. Cette table ne
 * porte que les formateurs (créée à l'inscription pour `role: 'formateur'`,
 * `docs/routes.md` > `/internal/create-administrative-profile`) : élève,
 * parent financeur et animateur pédagogique n'y ont jamais de ligne.
 * `identity-access-service` reste l'unique propriétaire du rôle
 * (`docs/architecture.md`, « Propriété du rôle ») : la liste des `userId`
 * d'un rôle donné lui est demandée (`GET /internal/accounts?role=`, déjà
 * consommée ailleurs — `dashboard-notification-service`, fan-out par rôle des
 * notifications), jamais devinée ou recopiée localement.
 *
 * NOTE SUR `animateur_pedagogique`. Un AP est un formateur promu
 * (`ProfilesService.promoteToAnimateurPedagogique`) : son
 * `TeacherPedagogicalProfile.isAnimateurPedagogique` passe à `true`, mais sa
 * ligne `teacher_validations` — créée quand il était encore `formateur` —
 * n'est pas retouchée par la promotion. Filtrer sur `teacher_validations`
 * seul mélangerait donc formateurs et AP dans la même liste. Filtrer par le
 * RÔLE COURANT renvoyé par `identity-access-service` sépare correctement les
 * deux tuiles, sans toucher à `teacher_validations`.
 *
 * CONTENU LIMITÉ AU SOCLE (même discipline que l'annuaire formateurs,
 * arbitrage du 2026-08-12) : `userId` (jamais affiché, sert uniquement à
 * router vers les écrans liés — profil/calendrier/cahier de texte, arbitrage
 * du 2026-08-09), `firstName`, `lastName`, `avatarUrl`, et les champs
 * pédagogiques déjà partagés par défaut à un administrateur pour ce rôle
 * (`level`/`subjects` pour un élève, `levels`/`subjects` pour un
 * formateur/AP). Les administrateurs sont exemptés du filtrage champ par
 * champ, mais cette liste reste volontairement étroite pour ne pas devenir
 * une porte dérobée à ce filtrage — même raisonnement que l'annuaire
 * formateurs.
 */
@Injectable()
export class RoleDirectoryService {
  private readonly logger = new Logger(RoleDirectoryService.name);
  private readonly avatarPublicPathPrefix: string;

  constructor(
    @InjectRepository(AdministrativeProfile)
    private readonly administrativeProfileRepo: Repository<AdministrativeProfile>,
    @InjectRepository(StudentPedagogicalProfile)
    private readonly studentPedaRepo: Repository<StudentPedagogicalProfile>,
    @InjectRepository(TeacherPedagogicalProfile)
    private readonly teacherPedaRepo: Repository<TeacherPedagogicalProfile>,
    private readonly identityAccessClient: IdentityAccessClient,
    private readonly teacherDirectoryService: TeacherDirectoryService,
    config: ConfigService,
  ) {
    this.avatarPublicPathPrefix =
      config.get<string>('AVATAR_PUBLIC_PATH_PREFIX') ?? DEFAULT_AVATAR_PUBLIC_PATH_PREFIX;
  }

  async listByRole(query: RoleDirectoryPageQueryDto, actor: Actor): Promise<RoleDirectoryPage> {
    if (!isAdministrator(actor.role)) {
      throw new ForbiddenException(
        "L'annuaire « Visualisation » est réservé aux rôles administratifs " +
          '(responsable pédagogique, administrateur financier, technicien informatique).',
      );
    }

    const role = query.role as DirectoryRole;

    if (role === UserRole.FORMATEUR) {
      return this.delegateToTeacherDirectory(query, actor);
    }

    return this.listNonTeacherRole(role, query);
  }

  /**
   * Rôle `formateur` : délégation pure vers l'annuaire déjà construit
   * (2026-08-12), reprojeté vers la forme commune de l'annuaire
   * « Visualisation » (`level` n'a pas de sens pour un formateur, toujours
   * `null` ici — distinct de `levels`, qui en porte plusieurs).
   */
  private async delegateToTeacherDirectory(
    query: RoleDirectoryPageQueryDto,
    actor: Actor,
  ): Promise<RoleDirectoryPage> {
    const teacherPage = await this.teacherDirectoryService.listValidatedTeachers(query, actor);
    return {
      data: teacherPage.data.map((teacher) => ({
        userId: teacher.userId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        avatarUrl: teacher.avatarUrl,
        level: null,
        levels: teacher.levels,
        subjects: teacher.subjects,
      })),
      page: teacherPage.page,
      limit: teacherPage.limit,
      total: teacherPage.total,
      totalPages: teacherPage.totalPages,
    };
  }

  /**
   * Rôles `eleve` / `parent_financeur` / `animateur_pedagogique` : la
   * population fait autorité auprès de `identity-access-service`
   * (non paginée de son côté, comme le fan-out par rôle des notifications),
   * la pagination et le tri se font ici, contre les profils locaux.
   */
  private async listNonTeacherRole(
    role: DirectoryRole,
    query: RoleDirectoryPageQueryDto,
  ): Promise<RoleDirectoryPage> {
    const page = query.page ?? DIRECTORY_PAGE_DEFAULT_PAGE;
    const limit = query.limit ?? DIRECTORY_PAGE_DEFAULT_LIMIT;

    let accounts: { userId: string }[];
    try {
      accounts = await this.identityAccessClient.listAccountsByRole(role);
    } catch (error) {
      if (error instanceof IdentityAccessUnavailableError) {
        this.logger.error(
          `identity-access-service indisponible pour lister le rôle « ${role} » : ` +
            `${error.message}. Annuaire dégradé à une page vide plutôt que de deviner la ` +
            'population.',
        );
        return { data: [], page, limit, total: 0, totalPages: 0 };
      }
      throw error;
    }

    const userIds = accounts.map((account) => account.userId);
    if (userIds.length === 0) {
      return { data: [], page, limit, total: 0, totalPages: 0 };
    }

    const pedagogicalEntity =
      role === UserRole.ELEVE
        ? StudentPedagogicalProfile
        : role === UserRole.ANIMATEUR_PEDAGOGIQUE
          ? TeacherPedagogicalProfile
          : null;

    const baseQuery = this.administrativeProfileRepo
      .createQueryBuilder('administrative')
      .where('administrative.userId IN (:...userIds)', { userIds });

    if (query.q) {
      // Recherche insensible à la casse sur prénom/nom, combinée au filtre de
      // rôle déjà posé ci-dessus — arbitrage du 2026-09-02 (`docs/architecture.md`
      // > « Reconstruction du rail gauche du RP » > « Compléments demandés le
      // 2026-09-02 », point 1).
      baseQuery.andWhere(
        '(administrative.firstName ILIKE :q OR administrative.lastName ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    if (pedagogicalEntity) {
      baseQuery.leftJoin(
        pedagogicalEntity,
        'pedagogical',
        'pedagogical.userId = administrative.userId',
      );
    }

    const matchedCount = await baseQuery.clone().getCount();
    if (matchedCount < userIds.length) {
      this.logger.error(
        `${userIds.length - matchedCount} compte(s) de rôle « ${role} » sans profil ` +
          'administratif : incohérence de données, le profil administratif est créé à ' +
          "l'inscription. Ces comptes n'apparaissent pas dans l'annuaire.",
      );
    }

    let selectQuery = baseQuery
      .select('administrative.userId', 'userId')
      .addSelect('administrative.firstName', 'firstName')
      .addSelect('administrative.lastName', 'lastName')
      .addSelect('administrative.avatarObjectKey', 'avatarObjectKey')
      .addSelect('administrative.avatarUpdatedAt', 'avatarUpdatedAt')
      .addSelect('administrative.updatedAt', 'administrativeUpdatedAt');

    if (pedagogicalEntity) {
      // Alias commun `levelRaw` : porte soit `level` (élève, valeur unique) soit
      // `levels` (AP, `simple-array`) selon le rôle — décodé par `toEntry` ci-dessous.
      selectQuery = selectQuery
        .addSelect(
          role === UserRole.ELEVE ? 'pedagogical.level' : 'pedagogical.levels',
          'levelRaw',
        )
        .addSelect('pedagogical.subjects', 'subjects');
    }

    const rows = await selectQuery
      .orderBy('administrative.lastName', 'ASC', 'NULLS LAST')
      .addOrderBy('administrative.firstName', 'ASC', 'NULLS LAST')
      .addOrderBy('administrative.userId', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<DirectoryRow>();

    const data = rows.map((row) => this.toEntry(role, row));

    return {
      data,
      page,
      limit,
      total: matchedCount,
      totalPages: limit > 0 ? Math.ceil(matchedCount / limit) : 0,
    };
  }

  private toEntry(role: DirectoryRole, row: DirectoryRow): RoleDirectoryEntry {
    return {
      userId: row.userId,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      avatarUrl: buildAvatarUrl(
        {
          userId: row.userId,
          avatarObjectKey: row.avatarObjectKey,
          avatarUpdatedAt: row.avatarUpdatedAt,
          updatedAt: row.administrativeUpdatedAt as Date,
        },
        this.avatarPublicPathPrefix,
      ),
      level: role === UserRole.ELEVE ? (row.levelRaw ?? null) : null,
      levels: role === UserRole.ANIMATEUR_PEDAGOGIQUE ? toStringArray(row.levelRaw) : null,
      subjects:
        role === UserRole.ELEVE || role === UserRole.ANIMATEUR_PEDAGOGIQUE
          ? toStringArray(row.subjects)
          : null,
    };
  }
}

/**
 * Colonnes `simple-array` renvoyées brutes par TypeORM sur une sélection non
 * hydratée — même conversion que `TeacherDirectoryService`
 * (`teacher-directory.service.ts`, `toStringArray`), dupliquée ici plutôt que
 * partagée : deux fichiers de moins de 30 lignes de dépendance croisée pour
 * une fonction pure de 6 lignes n'aurait rien simplifié.
 */
function toStringArray(raw: string | null | undefined): string[] | null {
  if (raw === null || raw === undefined) return null;
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values;
}

/** Colonne brute `level`/`levels` selon le rôle : texte simple pour un élève, `simple-array` pour un AP. */
interface DirectoryRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarObjectKey: string | null;
  avatarUpdatedAt: Date | null;
  administrativeUpdatedAt: Date | null;
  levelRaw: string | null;
  subjects: string | null;
}

/**
 * Entrée unifiée de l'annuaire « Visualisation », commune aux 4 rôles.
 * `level` (élève, une valeur) et `levels` (formateur/AP, plusieurs) restent
 * deux champs distincts plutôt qu'un seul renommé : ce sont deux données
 * différentes, déjà nommées différemment sur leurs entités respectives
 * (`StudentPedagogicalProfile.level` vs `TeacherPedagogicalProfile.levels`) —
 * les fusionner sous un nom unique confondrait « le niveau suivi » et « les
 * niveaux enseignés ». Un seul des deux est non-`null` selon le rôle de la
 * ligne, le second reste `null`.
 */
export interface RoleDirectoryEntry {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  level: string | null;
  levels: string[] | null;
  subjects: string[] | null;
}

export interface RoleDirectoryPage {
  data: RoleDirectoryEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

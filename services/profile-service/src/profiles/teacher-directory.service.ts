import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import {
  TeacherValidation,
  TeacherValidationStatus,
} from './entities/teacher-validation.entity';
import { Actor } from '../common/types/actor.type';
import { UserRole } from '../common/enums/user-role.enum';
import { isAdministrator } from '../relations/pedagogical-access.policy';
import {
  TeachersPageQueryDto,
  TEACHERS_PAGE_DEFAULT_LIMIT,
  TEACHERS_PAGE_DEFAULT_PAGE,
} from './dto/teachers-page.query.dto';

/**
 * LISTES DE FORMATEURS PAR STATUT DE VALIDATION.
 *
 * Deux routes, une seule mécanique — arbitrages du 2026-08-12 :
 *
 *  1. « Annuaire des formateurs validés » (`GET /profiles/teachers/validated`) :
 *     à l'étape 3 du flow « demande de professeur », le responsable pédagogique
 *     doit DÉSIGNER les formateurs destinataires d'une proposition, et faire
 *     saisir un UUID est interdit (arbitrage du 2026-08-09).
 *  2. « Validation des nouveaux formateurs »
 *     (`GET /profiles/teachers/pending-validation`) : la file de travail du RP,
 *     les formateurs qui viennent de s'inscrire et attendent d'être examinés.
 *
 * POURQUOI LES DEUX ICI. Ce sont deux TRANCHES DE LA MÊME POPULATION, découpées
 * sur `teacher_validations.status` : mêmes jointures, même socle de champs, même
 * pagination, même tri. Les tenir dans deux services distincts (la seconde
 * vivait dans `ProfilesService`) avait déjà produit une divergence réelle et
 * coûteuse : l'annuaire était borné et paginé, la file de validation renvoyait
 * un tableau nu non borné. Une seule mécanique rend cette divergence
 * impossible à réintroduire.
 *
 * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT, à ne pas élargir sans nouvel arbitrage :
 *  - la liste des validés est réservée aux RÔLES ADMINISTRATIFS (RP, AF, TI) ;
 *  - la file de validation est réservée au RP, seul à instruire un dossier ;
 *  - ce n'est en aucun cas l'annuaire global de tous les utilisateurs : cette
 *    question plus large reste ouverte et n'est pas anodine côté vie privée.
 *
 * CONTENU LIMITÉ AU SOCLE DE VISIBILITÉ (`userId`, `firstName`, `lastName`,
 * `levels`, `subjects`). Les administrateurs sont pourtant EXEMPTÉS du filtrage
 * champ par champ : la restriction est donc ici délibérée, et non la
 * conséquence d'un filtre. Servir la fiche entière ferait de ces listes une
 * porte dérobée au filtrage — exactement ce que le contrat figé de la
 * résolution de nom (`src/internal/display-name.ts`) interdit par ailleurs.
 * Tout besoin d'un champ supplémentaire passe par `GET /profiles/:userId` et
 * ses règles de droit.
 *
 * Service séparé plutôt que des méthodes de plus sur `ProfilesService` : celui-ci
 * dépasse déjà largement les seuils de `docs/conventions/services-convention.md`,
 * et ces listes n'ont besoin d'aucune de ses dépendances (ni relations, ni
 * événements, ni identity-access, ni visibilité).
 */

/**
 * Une entrée de liste. `firstName`/`lastName` peuvent être `null` : c'est une
 * incohérence de données (le profil administratif est obligatoire, créé à
 * l'inscription), journalisée comme telle — mais elle ne doit pas faire échouer
 * la liste entière, sans quoi un seul enregistrement abîmé priverait le RP de
 * tout l'annuaire.
 *
 * `levels`/`subjects` à `null` signifient « non renseigné » : le profil
 * pédagogique est facultatif (arbitrage du 2026-08-07). Un tableau vide et
 * `null` ne sont pas confondus.
 */
export interface TeacherSummary {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  levels: string[] | null;
  subjects: string[] | null;
}

/**
 * Entrée de la FILE DE VALIDATION : le socle, plus la seule donnée dont le RP a
 * besoin pour prioriser son travail — depuis quand ce formateur attend.
 *
 * `pendingSince` et non `createdAt` : dans une liste de PERSONNES, `createdAt`
 * se lirait « date de création du formateur » alors qu'il s'agit de la date de
 * l'enregistrement de validation. Un nom qui demande une note de bas de page
 * pour être compris est un nom à changer (arbitrage du 2026-08-08 : l'écart se
 * résorbe, il ne se documente pas).
 *
 * `userId` et non `teacherId` : c'est la MÊME DONNÉE que dans l'annuaire des
 * validés et que partout ailleurs dans ce service (`administrative_profiles`,
 * `GET /internal/profiles/:userId/display-name`). Deux noms concurrents pour
 * l'identifiant d'une personne selon la liste consultée étaient exactement ce
 * que l'arbitrage du 2026-08-08 interdit. La colonne d'entité reste
 * `teacher_validations.teacher_id` : c'est la clé étrangère du RECORD, pas le
 * nom exposé de la personne.
 */
export interface PendingTeacherSummary extends TeacherSummary {
  pendingSince: Date;
}

/**
 * Enveloppe de pagination, identique à celle déjà servie par
 * `archive-document-service` (`{data, page, limit, total, totalPages}`) :
 * un tableau nu ne dirait pas combien de formateurs restent à afficher, et la
 * règle « un seul nom par donnée » interdit d'en inventer une variante.
 */
export interface TeachersPage<TEntry extends TeacherSummary> {
  data: TEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ValidatedTeachersPage = TeachersPage<TeacherSummary>;
export type PendingTeachersPage = TeachersPage<PendingTeacherSummary>;

/** Colonnes brutes renvoyées par la requête de liste. */
interface TeacherRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  levels: string | null;
  subjects: string | null;
  createdAt: Date;
}

/**
 * Les colonnes `simple-array` de TypeORM ne sont converties en tableau que lors
 * de l'hydratation d'une entité : une sélection brute renvoie la chaîne stockée
 * (`"seconde,premiere"`). La conversion est faite ici, une seule fois, pour que
 * la réponse porte bien des tableaux — et non une chaîne que chaque appelant
 * découperait à sa façon.
 */
function toStringArray(raw: string | null | undefined): string[] | null {
  if (raw === null || raw === undefined) return null;
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values;
}

@Injectable()
export class TeacherDirectoryService {
  private readonly logger = new Logger(TeacherDirectoryService.name);

  constructor(
    @InjectRepository(TeacherValidation)
    private readonly teacherValidationRepo: Repository<TeacherValidation>,
  ) {}

  /**
   * Liste paginée des formateurs VALIDÉS, triée par nom puis prénom.
   *
   * Le contrôle de rôle est déjà déclaré par `@Roles` sur le contrôleur ; il est
   * répété ici parce que l'autorisation liée à la ressource appartient au
   * service (`docs/conventions/services-convention.md`) et qu'un appel interne
   * ne passerait pas par le guard.
   */
  async listValidatedTeachers(
    query: TeachersPageQueryDto,
    actor: Actor,
  ): Promise<ValidatedTeachersPage> {
    if (!isAdministrator(actor.role)) {
      throw new ForbiddenException(
        "L'annuaire des formateurs validés est réservé aux rôles administratifs " +
          '(responsable pédagogique, administrateur financier, technicien informatique).',
      );
    }

    const page = await this.listTeachersByValidationStatus('validated', query, (row) => ({
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      levels: toStringArray(row.levels),
      subjects: toStringArray(row.subjects),
    }));

    return page;
  }

  /**
   * Liste paginée des formateurs EN ATTENTE de validation — la file de travail
   * du responsable pédagogique.
   *
   * TRIÉE PAR ANCIENNETÉ, contrairement à l'annuaire trié par nom : ce qui
   * compte ici n'est pas de retrouver quelqu'un, c'est de ne laisser personne
   * attendre. Le formateur inscrit le premier est examiné le premier.
   *
   * RP UNIQUEMENT, et non les rôles administratifs en bloc : instruire un
   * dossier de formateur est son métier. Le TI peut trancher un dossier déjà
   * ouvert (`PATCH /profiles/:teacherId/validation`), il n'a pas à disposer de
   * la file d'attente.
   */
  async listTeachersPendingValidation(
    query: TeachersPageQueryDto,
    actor: Actor,
  ): Promise<PendingTeachersPage> {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException(
        'La liste des formateurs en attente de validation est réservée au responsable ' +
          'pédagogique.',
      );
    }

    return this.listTeachersByValidationStatus(
      'pending',
      query,
      (row) => ({
        userId: row.userId,
        firstName: row.firstName,
        lastName: row.lastName,
        levels: toStringArray(row.levels),
        subjects: toStringArray(row.subjects),
        pendingSince: row.createdAt,
      }),
      'oldestFirst',
    );
  }

  /**
   * Mécanique commune aux deux listes : mêmes jointures, même pagination, même
   * signalement d'incohérence. Seuls varient le statut filtré, le tri et la
   * projection de chaque ligne.
   *
   * Le tri porte sur l'ENSEMBLE de la liste, pas sur la page : trier après
   * découpage donnerait des pages cohérentes entre elles mais un ordre global
   * faux, défaut invisible tant qu'on ne dépasse pas la première page.
   */
  private async listTeachersByValidationStatus<TEntry extends TeacherSummary>(
    status: TeacherValidationStatus,
    query: TeachersPageQueryDto,
    toEntry: (row: TeacherRow) => TEntry,
    order: 'byName' | 'oldestFirst' = 'byName',
  ): Promise<TeachersPage<TEntry>> {
    const page = query.page ?? TEACHERS_PAGE_DEFAULT_PAGE;
    const limit = query.limit ?? TEACHERS_PAGE_DEFAULT_LIMIT;

    const baseQuery = this.teacherValidationRepo
      .createQueryBuilder('validation')
      // `leftJoin` et non `innerJoin` : un formateur dont le profil
      // administratif manquerait doit rester VISIBLE et signalé, pas disparaître
      // de la liste sans que personne ne s'en aperçoive.
      .leftJoin(
        AdministrativeProfile,
        'administrative',
        'administrative.userId = validation.teacherId',
      )
      .leftJoin(
        TeacherPedagogicalProfile,
        'pedagogical',
        'pedagogical.userId = validation.teacherId',
      )
      .where('validation.status = :status', { status });

    const total = await baseQuery.clone().getCount();

    const rows = await this.applyOrder(
      baseQuery
        .select('validation.teacherId', 'userId')
        .addSelect('administrative.firstName', 'firstName')
        .addSelect('administrative.lastName', 'lastName')
        .addSelect('pedagogical.levels', 'levels')
        .addSelect('pedagogical.subjects', 'subjects')
        .addSelect('validation.createdAt', 'createdAt'),
      order,
    )
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<TeacherRow>();

    const data = rows.map((row) => {
      if (row.firstName === null && row.lastName === null) {
        this.logger.error(
          `Formateur (statut de validation « ${status} ») sans profil administratif ` +
            `(userId=${row.userId}) : incohérence de données, le profil administratif est ` +
            "créé à l'inscription.",
        );
      }
      return toEntry(row);
    });

    return {
      data,
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  /**
   * Le départage final par `teacherId` n'est pas cosmétique : sans ordre stable,
   * deux homonymes (ou deux inscriptions à la même milliseconde) peuvent
   * apparaître sur deux pages, ou sur aucune.
   */
  private applyOrder(
    queryBuilder: SelectQueryBuilder<TeacherValidation>,
    order: 'byName' | 'oldestFirst',
  ): SelectQueryBuilder<TeacherValidation> {
    if (order === 'oldestFirst') {
      return queryBuilder
        .orderBy('validation.createdAt', 'ASC')
        .addOrderBy('validation.teacherId', 'ASC');
    }
    return queryBuilder
      .orderBy('administrative.lastName', 'ASC', 'NULLS LAST')
      .addOrderBy('administrative.firstName', 'ASC', 'NULLS LAST')
      .addOrderBy('validation.teacherId', 'ASC');
  }
}

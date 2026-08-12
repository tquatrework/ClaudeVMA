import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import { TeacherValidation } from './entities/teacher-validation.entity';
import { Actor } from '../common/types/actor.type';
import { isAdministrator } from '../relations/pedagogical-access.policy';
import {
  ListValidatedTeachersQueryDto,
  VALIDATED_TEACHERS_DEFAULT_LIMIT,
  VALIDATED_TEACHERS_DEFAULT_PAGE,
} from './dto/list-validated-teachers.query.dto';

/**
 * ANNUAIRE DES FORMATEURS VALIDÉS — arbitrage du 2026-08-12
 * (`docs/architecture.md` > « Annuaire des formateurs validés »).
 *
 * Pourquoi ce service existe : à l'étape 3 du flow « demande de professeur », le
 * responsable pédagogique doit DÉSIGNER les formateurs à qui envoyer une
 * proposition. Aucune route ne le permettait —
 * `GET /profiles/teachers/pending-validation` ne liste que les formateurs *en
 * attente*, c'est-à-dire précisément ceux qu'on ne propose pas — et faire saisir
 * un UUID est interdit (arbitrage du 2026-08-09 : aucun identifiant technique
 * n'est lu ni affiché par un utilisateur).
 *
 * PÉRIMÈTRE VOLONTAIREMENT ÉTROIT, à ne pas élargir sans nouvel arbitrage :
 *  - seulement les formateurs dont la validation est `validated` ;
 *  - seulement pour les RÔLES ADMINISTRATIFS (RP, AF, TI). Ce n'est pas
 *    l'annuaire global de tous les utilisateurs : cette question plus large
 *    reste ouverte et n'est pas anodine côté vie privée.
 *
 * CONTENU LIMITÉ AU SOCLE DE VISIBILITÉ (`userId`, `firstName`, `lastName`,
 * `levels`, `subjects`). Les administrateurs sont pourtant EXEMPTÉS du filtrage
 * champ par champ : la restriction est donc ici délibérée, et non la
 * conséquence d'un filtre. Servir la fiche entière ferait de cette liste une
 * porte dérobée au filtrage — exactement ce que le contrat figé de la
 * résolution de nom (`src/internal/display-name.ts`) interdit par ailleurs.
 * Tout besoin d'un champ supplémentaire passe par `GET /profiles/:userId` et
 * ses règles de droit.
 *
 * Service séparé plutôt qu'une méthode de plus sur `ProfilesService` : celui-ci
 * dépasse déjà largement les seuils de `docs/conventions/services-convention.md`,
 * et l'annuaire n'a besoin d'aucune de ses dépendances (ni relations, ni
 * événements, ni identity-access, ni visibilité).
 */

/**
 * Une entrée d'annuaire. `firstName`/`lastName` peuvent être `null` : c'est une
 * incohérence de données (le profil administratif est obligatoire, créé à
 * l'inscription), journalisée comme telle — mais elle ne doit pas faire échouer
 * la liste entière, sans quoi un seul enregistrement abîmé priverait le RP de
 * tout l'annuaire.
 *
 * `levels`/`subjects` à `null` signifient « non renseigné » : le profil
 * pédagogique est facultatif (arbitrage du 2026-08-07). Un tableau vide et
 * `null` ne sont pas confondus.
 */
export interface ValidatedTeacherSummary {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  levels: string[] | null;
  subjects: string[] | null;
}

/**
 * Enveloppe de pagination, identique à celle déjà servie par
 * `archive-document-service` (`{data, page, limit, total, totalPages}`) :
 * un tableau nu ne dirait pas combien de formateurs restent à afficher, et la
 * règle « un seul nom par donnée » interdit d'en inventer une variante.
 */
export interface ValidatedTeachersPage {
  data: ValidatedTeacherSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Colonnes brutes renvoyées par la requête d'annuaire. */
interface ValidatedTeacherRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  levels: string | null;
  subjects: string | null;
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
   * Liste paginée des formateurs validés, triée par nom puis prénom.
   *
   * Le tri porte sur l'ENSEMBLE de la liste, pas sur la page : trier après
   * découpage donnerait des pages cohérentes entre elles mais un ordre global
   * faux, défaut invisible tant qu'on ne dépasse pas la première page.
   *
   * Le contrôle de rôle est déjà déclaré par `@Roles` sur le contrôleur ; il est
   * répété ici parce que l'autorisation liée à la ressource appartient au
   * service (`docs/conventions/services-convention.md`) et qu'un appel interne
   * ne passerait pas par le guard.
   */
  async listValidatedTeachers(
    query: ListValidatedTeachersQueryDto,
    actor: Actor,
  ): Promise<ValidatedTeachersPage> {
    if (!isAdministrator(actor.role)) {
      throw new ForbiddenException(
        "L'annuaire des formateurs validés est réservé aux rôles administratifs " +
          '(responsable pédagogique, administrateur financier, technicien informatique).',
      );
    }

    const page = query.page ?? VALIDATED_TEACHERS_DEFAULT_PAGE;
    const limit = query.limit ?? VALIDATED_TEACHERS_DEFAULT_LIMIT;

    const baseQuery = this.teacherValidationRepo
      .createQueryBuilder('validation')
      // `leftJoin` et non `innerJoin` : un formateur validé dont le profil
      // administratif manquerait doit rester VISIBLE et signalé, pas disparaître
      // de l'annuaire sans que personne ne s'en aperçoive.
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
      .where('validation.status = :status', { status: 'validated' });

    const total = await baseQuery.clone().getCount();

    const rows = await baseQuery
      .select('validation.teacherId', 'userId')
      .addSelect('administrative.firstName', 'firstName')
      .addSelect('administrative.lastName', 'lastName')
      .addSelect('pedagogical.levels', 'levels')
      .addSelect('pedagogical.subjects', 'subjects')
      .orderBy('administrative.lastName', 'ASC', 'NULLS LAST')
      .addOrderBy('administrative.firstName', 'ASC', 'NULLS LAST')
      // Départage stable : deux homonymes doivent toujours sortir dans le même
      // ordre, sinon un même formateur peut apparaître sur deux pages ou sur
      // aucune.
      .addOrderBy('validation.teacherId', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<ValidatedTeacherRow>();

    const data = rows.map((row) => {
      if (row.firstName === null && row.lastName === null) {
        this.logger.error(
          `Formateur validé sans profil administratif (userId=${row.userId}) : ` +
            "incohérence de données, le profil administratif est créé à l'inscription.",
        );
      }
      return {
        userId: row.userId,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        levels: toStringArray(row.levels),
        subjects: toStringArray(row.subjects),
      };
    });

    return {
      data,
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}

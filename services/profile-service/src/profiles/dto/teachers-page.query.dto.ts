import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Paramètres de pagination COMMUNS aux deux listes de formateurs :
 * `GET /profiles/teachers/validated` (annuaire) et
 * `GET /profiles/teachers/pending-validation` (file de validation du RP).
 *
 * UN SEUL DTO POUR LES DEUX, et non deux jumeaux (arbitrage du 2026-08-08, « un
 * seul nom par donnée ») : ce sont deux tranches de la même population, filtrées
 * sur le statut de validation. Deux DTO auraient laissé leurs plafonds diverger
 * en silence à la première évolution — c'est précisément la famille de défauts
 * que ferme l'interdiction des plafonds cachés.
 *
 * PLAFOND DÉCLARÉ, JAMAIS CACHÉ (arbitrage du 2026-08-10 sur les plafonds, repris
 * par l'arbitrage du 2026-08-12 sur l'annuaire : « liste bornée et paginée dès
 * l'origine — un plafond non déclaré est un plafond caché »).
 *
 * Deux conséquences tenues ici :
 *  1. la borne est une CONSTANTE EXPORTÉE, lisible par les tests, la
 *     documentation Swagger et `docs/routes.md` — pas un nombre écrit trois fois ;
 *  2. un `limit` au-dessus du plafond est REFUSÉ en `400` avec un message en
 *     français, jamais ramené en silence à 100. Rogner la demande sans le dire
 *     ferait croire à l'appelant qu'il a tout reçu — c'est la famille de défauts
 *     « accepter puis ignorer un champ » fermée par l'arbitrage du 2026-08-09.
 */
export const TEACHERS_PAGE_DEFAULT_PAGE = 1;
export const TEACHERS_PAGE_DEFAULT_LIMIT = 20;
export const TEACHERS_PAGE_MAX_LIMIT = 100;

export class TeachersPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le numéro de page doit être un nombre entier.' })
  @Min(TEACHERS_PAGE_DEFAULT_PAGE, {
    message: `Le numéro de page commence à ${TEACHERS_PAGE_DEFAULT_PAGE}.`,
  })
  page?: number = TEACHERS_PAGE_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le nombre de formateurs par page doit être un nombre entier.' })
  @Min(1, { message: 'Le nombre de formateurs par page doit être au moins de 1.' })
  @Max(TEACHERS_PAGE_MAX_LIMIT, {
    message:
      `Le nombre de formateurs par page ne peut pas dépasser ${TEACHERS_PAGE_MAX_LIMIT}. ` +
      'Demandez les pages suivantes pour obtenir la suite de la liste.',
  })
  limit?: number = TEACHERS_PAGE_DEFAULT_LIMIT;

  /**
   * Recherche insensible à la casse sur `firstName`/`lastName`, ajoutée le
   * 2026-09-02 en complément de l'annuaire « Visualisation » du RP
   * (`docs/architecture.md`, « Reconstruction du rail gauche du RP »,
   * « Compléments demandés le 2026-09-02 », point 1). Toujours **combinée** au
   * filtre de statut de validation déjà en place, jamais un remplacement : une
   * recherche vide se comporte exactement comme avant (aucun filtre
   * supplémentaire), une recherche non vide se **compose** avec la pagination —
   * appliquée côté serveur, avant le découpage en page, jamais un filtrage
   * client sur une seule page déjà chargée.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le terme de recherche doit être une chaîne de caractères.' })
  @MaxLength(100, { message: 'Le terme de recherche ne peut pas dépasser 100 caractères.' })
  q?: string;
}

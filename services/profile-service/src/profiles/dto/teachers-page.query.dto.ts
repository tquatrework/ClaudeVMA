import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

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
}

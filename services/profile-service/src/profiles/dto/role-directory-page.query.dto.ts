import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * Rôles couverts par l'annuaire « Visualisation » du RP
 * (`docs/architecture.md`, « Reconstruction du rail gauche du RP »,
 * précision du 2026-09-02). PAS l'enum `UserRole` complet : les rôles
 * administratifs (RP, AF, TI) ne sont pas des personnes à « retrouver », ils
 * sont ceux qui consultent l'annuaire — les y inclure ouvrirait une liste que
 * personne n'a demandée.
 */
export const DIRECTORY_ROLES = [
  UserRole.ELEVE,
  UserRole.PARENT_FINANCEUR,
  UserRole.FORMATEUR,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
] as const;

export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

export const DIRECTORY_PAGE_DEFAULT_PAGE = 1;
export const DIRECTORY_PAGE_DEFAULT_LIMIT = 20;
export const DIRECTORY_PAGE_MAX_LIMIT = 100;

/**
 * Paramètres de `GET /profiles/directory` : mêmes bornes de pagination que
 * `TeachersPageQueryDto` (plafond déclaré, jamais caché — arbitrage du
 * 2026-08-10/2026-08-12), plus le filtre `role` propre à cette route
 * généraliste.
 */
export class RoleDirectoryPageQueryDto {
  @IsIn(DIRECTORY_ROLES, {
    message: `Le rôle doit être l'un des suivants : ${DIRECTORY_ROLES.join(', ')}.`,
  })
  role: DirectoryRole;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le numéro de page doit être un nombre entier.' })
  @Min(DIRECTORY_PAGE_DEFAULT_PAGE, {
    message: `Le numéro de page commence à ${DIRECTORY_PAGE_DEFAULT_PAGE}.`,
  })
  page?: number = DIRECTORY_PAGE_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Le nombre d'utilisateurs par page doit être un nombre entier." })
  @Min(1, { message: "Le nombre d'utilisateurs par page doit être au moins de 1." })
  @Max(DIRECTORY_PAGE_MAX_LIMIT, {
    message:
      `Le nombre d'utilisateurs par page ne peut pas dépasser ${DIRECTORY_PAGE_MAX_LIMIT}. ` +
      'Demandez les pages suivantes pour obtenir la suite de la liste.',
  })
  limit?: number = DIRECTORY_PAGE_DEFAULT_LIMIT;
}

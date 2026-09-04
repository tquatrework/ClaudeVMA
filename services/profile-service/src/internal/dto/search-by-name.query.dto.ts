import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Paramètres de `GET /internal/profiles/search-by-name` — recherche par nom
 * pour la fonctionnalité Contacts de `communication-service` (arbitrage du
 * 2026-09-04, `docs/architecture/contacts-messagerie.md`, point 11).
 *
 * `q` est OBLIGATOIRE (contrairement à `RoleDirectoryPageQueryDto.q`, où la
 * recherche est un affinage optionnel d'une liste déjà bornée par rôle) :
 * cette route n'a pas d'autre filtre, un `q` vide renverrait la totalité des
 * profils administratifs de la plateforme.
 */
export class SearchByNameQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Le terme de recherche doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le terme de recherche ne peut pas être vide.' })
  @MaxLength(100, { message: 'Le terme de recherche ne peut pas dépasser 100 caractères.' })
  q: string;
}

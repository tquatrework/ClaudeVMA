import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Body for POST /internal/create-administrative-profile.
 *
 * This is the single write path for firstName/lastName/phone on account
 * onboarding: identity-access-service no longer persists these fields
 * itself and calls this route as a mandatory (not best-effort) step right
 * after account creation. firstName/lastName are required; phone stays
 * optional since not every account-creation flow collects it (e.g. RP/TI/
 * admin financier accounts created without a phone number), but when
 * provided it is validated and persisted just as reliably as the name —
 * see ProfilesService.bootstrapAdministrativeProfile (idempotent upsert).
 * ValidationPipe (whitelist + forbidNonWhitelisted + transform) turns any
 * violation below into a 400 with an explicit per-field message,
 * distinguishable by the caller from a 5xx (unexpected/server-side) failure.
 */
export class CreateAdministrativeProfileDto {
  @IsUUID() userId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20) phone?: string;

  /**
   * Date de naissance au format ISO (YYYY-MM-DD).
   *
   * Accepté à la création depuis le 2026-08-09 : la colonne existait déjà en
   * base et le champ était modifiable via PUT /profiles/:userId/administrative,
   * mais la CRÉATION l'ignorait — `birthDate` avait donc été retiré du
   * formulaire d'inscription faute d'être stocké nulle part. Ce champ permet à
   * identity-access-service de le relayer dès l'inscription
   * (docs/proposition-profils.md §3).
   *
   * Optionnel : tous les flux de création de compte ne collectent pas de date
   * de naissance (comptes RP, TI, administrateur financier).
   * `bootstrapAdministrativeProfile` le persiste avec la même fiabilité que
   * les autres champs lorsqu'il est fourni.
   */
  @IsOptional() @IsDateString() birthDate?: string;
}

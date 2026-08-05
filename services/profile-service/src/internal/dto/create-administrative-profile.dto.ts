import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
 * ValidationPipe (whitelist + transform) turns any violation below into a
 * 400 with an explicit per-field message, distinguishable by the caller
 * from a 5xx (unexpected/server-side) failure.
 */
export class CreateAdministrativeProfileDto {
  @IsUUID() userId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20) phone?: string;
}

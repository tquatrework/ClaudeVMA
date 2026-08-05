import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Body for POST /internal/create-parent-profile.
 *
 * Mirrors CreateAdministrativeProfileDto: a parent_financeur only ever gets
 * an administrative profile (no pedagogical profile). firstName/lastName are
 * kept optional here, consistent with CreateAdministrativeProfileDto — this
 * route is not currently wired into any orchestration-service workflow (see
 * docs/microservices.md workflows), so making them mandatory is left to a
 * dedicated session once a concrete caller/contract exists.
 */
export class CreateParentProfileDto {
  @IsUUID() userId: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
}

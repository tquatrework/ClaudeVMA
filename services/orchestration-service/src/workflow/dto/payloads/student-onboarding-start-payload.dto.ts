import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * Forme validée du `payload` attendu par `POST /workflows/student-onboarding/start`.
 * Ne couvre que les champs lus/dérivés par orchestration-service lui-même
 * (firstName/lastName propagés à identity-access-service ET profile-service,
 * parentAccountId utilisé par l'étape optionnelle link-parent) — le reste du
 * payload (email, password, consents, birthDate, level, ...) reste opaque et
 * relayé tel quel, conformément à l'exception "payloads de routage pur" de
 * `docs/conventions/services-convention.md`.
 */
export class StudentOnboardingStartPayloadDto {
  @IsString({ message: 'firstName est requis' })
  @IsNotEmpty({ message: 'firstName est requis' })
  firstName: string;

  @IsString({ message: 'lastName est requis' })
  @IsNotEmpty({ message: 'lastName est requis' })
  lastName: string;

  @IsOptional()
  @IsString()
  parentAccountId?: string;

  // Même logique conditionnelle que côté identity-access-service : requis
  // uniquement lorsque des informations parent sont fournies dans ce workflow
  // (matérialisées ici par la présence de parentAccountId).
  @ValidateIf((payload: StudentOnboardingStartPayloadDto) => !!payload.parentAccountId)
  @IsString({ message: 'parentFirstName est requis lorsque parentAccountId est fourni' })
  @IsNotEmpty({ message: 'parentFirstName est requis lorsque parentAccountId est fourni' })
  parentFirstName?: string;

  @ValidateIf((payload: StudentOnboardingStartPayloadDto) => !!payload.parentAccountId)
  @IsString({ message: 'parentLastName est requis lorsque parentAccountId est fourni' })
  @IsNotEmpty({ message: 'parentLastName est requis lorsque parentAccountId est fourni' })
  parentLastName?: string;
}

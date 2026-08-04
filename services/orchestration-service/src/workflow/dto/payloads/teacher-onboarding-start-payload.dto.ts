import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Forme validée du `payload` attendu par `POST /workflows/teacher-onboarding/start`.
 * Cf. `StudentOnboardingStartPayloadDto` pour le principe : seuls les champs
 * lus/propagés par orchestration-service lui-même sont typés ici.
 */
export class TeacherOnboardingStartPayloadDto {
  @IsString({ message: 'firstName est requis' })
  @IsNotEmpty({ message: 'firstName est requis' })
  firstName: string;

  @IsString({ message: 'lastName est requis' })
  @IsNotEmpty({ message: 'lastName est requis' })
  lastName: string;
}

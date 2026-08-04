import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Forme validée du `payload` attendu par `POST /workflows/student-onboarding/start`.
 * Ne couvre que les champs lus/dérivés par orchestration-service lui-même
 * (firstName/lastName propagés à identity-access-service ET profile-service,
 * parentAccountId utilisé par l'étape optionnelle link-parent) — le reste du
 * payload (email, password, consents, birthDate, level, ...) reste opaque et
 * relayé tel quel, conformément à l'exception "payloads de routage pur" de
 * `docs/conventions/services-convention.md`.
 *
 * parentAccountId désigne un compte parent déjà existant (cf.
 * `docs/microservices.md`, step 3 du workflow : "Lier le parent financeur si
 * fourni" — pas une création). Ce parent a donc déjà fourni son propre
 * prénom/nom lors de la création de SON compte ; aucun champ parentFirstName/
 * parentLastName n'est donc requis ou lu ici : ce serait redondant et
 * risquerait de faire diverger le nom déjà enregistré pour ce compte.
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
}

import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

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

  /**
   * RÔLE DU COMPTE créé, transporté par l'appel plutôt que redemandé.
   *
   * Attendu par l'arbitrage du 2026-08-07 : « le rôle conditionne la
   * quasi-totalité des règles de droit, il doit accompagner systématiquement les
   * appels interservices, au même titre que `x-correlation-id`. Aucun service ne
   * doit avoir à le redemander ni à le deviner. En conséquence,
   * `CreateAdministrativeProfileDto` transporte le rôle. » Ce champ manquait
   * encore au 2026-08-12.
   *
   * CE QU'IL DÉCLENCHE ICI, et rien de plus : `formateur` fait créer
   * l'enregistrement de validation au statut `pending` (arbitrage du
   * 2026-08-12), sans quoi le formateur n'apparaît dans aucune file du
   * responsable pédagogique et ne peut jamais être validé. Il ne préinitialise
   * AUCUN profil pédagogique — celui-ci reste facultatif.
   *
   * NON PERSISTÉ, NON EXPOSÉ. `identity-access-service` reste l'unique
   * propriétaire du rôle ; `profile-service` le consomme comme contexte de
   * décision. Le stocker recréerait exactement le problème d'appartenance
   * tranché pour `firstName`/`lastName`/`phone`.
   *
   * OPTIONNEL À DESSEIN : le rendre obligatoire ferait échouer en `400` toute
   * création de compte tant qu'identity-access-service ne l'envoie pas, c'est-à-dire
   * casserait l'inscription entière pour corriger un défaut de validation. Son
   * absence est en revanche journalisée en `warn` côté service — un champ
   * manquant qui a des conséquences ne doit pas passer inaperçu.
   */
  @IsOptional()
  @IsEnum(UserRole, {
    message: `Le rôle doit être l'une des valeurs suivantes : ${Object.values(UserRole).join(', ')}.`,
  })
  role?: UserRole;
}

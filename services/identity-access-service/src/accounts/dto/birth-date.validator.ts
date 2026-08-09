import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Forme acceptée pour une date de naissance : date calendaire ISO `YYYY-MM-DD`,
 * sans heure ni fuseau. Contrat imposé par profile-service
 * (`POST /internal/create-administrative-profile`, champ `birthDate` accepté
 * depuis le 2026-08-09), seul lieu de stockage de cette donnée —
 * identity-access-service ne la persiste jamais, il ne fait que la relayer.
 */
export const BIRTH_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const BIRTH_DATE_ERROR_MESSAGE =
  'birthDate must be an ISO calendar date formatted YYYY-MM-DD (example: 2005-06-15)';

/**
 * Vraie date calendaire au format `YYYY-MM-DD`.
 *
 * La regex seule ne suffit pas : `2005-02-30` et `2005-13-01` la passent alors
 * qu'aucune de ces dates n'existe. On reconstruit donc la date en UTC et on
 * vérifie qu'aucune composante n'a été normalisée par `Date` (qui transforme
 * silencieusement le 30 février en 2 mars). Une date impossible doit produire un
 * 400 explicite ici, pas un 503 déclenché plus tard par un refus de
 * profile-service.
 */
export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !BIRTH_DATE_REGEX.test(value)) return false;

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

/**
 * Décorateur de validation de forme pour un champ de date de naissance.
 *
 * Enregistré via `registerDecorator` (et non composé de `@Matches`) pour que la
 * propriété porte une métadonnée class-validator unique : c'est cette métadonnée
 * que lit `RejectUnknownBodyFieldsGuard` (@StrictBody) pour déterminer les champs
 * acceptés par la route, et que lit la ValidationPipe globale pour `whitelist`.
 * Un champ décoré ici cesse donc d'être un « champ inconnu rejeté en 400 » et
 * devient un champ accepté, listé automatiquement dans le message d'erreur du
 * garde.
 */
export function IsIsoBirthDate(validationOptions?: ValidationOptions) {
  return function registerIsoBirthDateValidation(target: object, propertyName: string): void {
    registerDecorator({
      name: 'isIsoBirthDate',
      target: target.constructor,
      propertyName,
      options: { message: BIRTH_DATE_ERROR_MESSAGE, ...validationOptions },
      validator: {
        validate(value: unknown): boolean {
          return isIsoCalendarDate(value);
        },
      },
    });
  };
}

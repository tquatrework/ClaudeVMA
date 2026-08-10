import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Marque un champ comme GÉRÉ PAR LE SERVEUR : présent en lecture, refusé en
 * écriture sur cette route.
 *
 * Pourquoi un validateur plutôt qu'une simple absence du DTO : sans
 * déclaration, `forbidNonWhitelisted` refuse bien la requête, mais avec le
 * message générique « property avatarUrl should not exist », en anglais et
 * sans indiquer par où passer. Ici le champ reste déclaré — donc documenté
 * dans Swagger — et le refus porte une explication en français, conforme à la
 * règle de langue du 2026-08-09.
 *
 * Le champ ABSENT (`undefined`) est valide : la règle interdit de l'envoyer,
 * elle n'oblige évidemment pas à le fournir. Toute autre valeur, `null`
 * compris, est refusée : envoyer `null` est une tentative de modification
 * comme une autre, et l'absorber en silence est exactement ce que
 * `docs/architecture.md` proscrit.
 */
export function IsServerManagedField(
  explanation: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function registerOnProperty(target: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isServerManagedField',
      target: target.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return value === undefined;
        },
        defaultMessage(args: ValidationArguments): string {
          return `Le champ « ${args.property} » est géré par l’application et ne peut pas être envoyé ici. ${explanation}`;
        },
      },
    });
  };
}

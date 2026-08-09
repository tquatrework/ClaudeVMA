import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateConsentDto } from '../../consents/dto/create-consent.dto';
import { ConsentType, DEFAULT_CONSENT_VERSION } from '../../consents/entities/consent-record.entity';

/**
 * Un consentement est enregistré une seule fois par type : le tableau ne peut
 * donc pas contenir plus d'entrées qu'il n'existe de types.
 */
export const MAX_REGISTRATION_CONSENTS = Object.values(ConsentType).length;

/**
 * Champ `consents` des routes de création de compte.
 *
 * Forme identique au corps de `POST /consents`, à ceci près qu'on en accepte
 * plusieurs d'un coup : chaque élément est un `CreateConsentDto`
 * (`{consentType, version?}`) — même nom de champ, même validation, même version
 * par défaut. Le formulaire d'inscription recueille RGPD et CGU en même temps,
 * il les transmet donc en une seule requête au lieu de deux appels
 * `POST /consents` après connexion (arbitrage d'architecture du 2026-08-09).
 *
 * Chaque consentement transmis est réellement enregistré dans `consent_records`
 * avec sa version, l'adresse IP de la requête et son horodatage — jamais accepté
 * puis ignoré.
 *
 * @param subjectDescription Personne à qui les consentements se rapportent, pour
 *   la documentation Swagger (ex. « the student »). Un consentement ne vaut que
 *   pour la personne qui le donne : ce champ ne couvre jamais le compte lié créé
 *   dans le même appel.
 */
export function RegistrationConsents(subjectDescription: string) {
  return applyDecorators(
    ApiPropertyOptional({
      type: [CreateConsentDto],
      description:
        `Consents accepted by ${subjectDescription} in the registration form, recorded exactly like ` +
        `POST /consents (same table, same default version '${DEFAULT_CONSENT_VERSION}', same ip_address and ` +
        'signed_at capture). Each entry is {consentType, version?}. When rgpd and cgu are both present, ' +
        'the account is created ACTIVE instead of PENDING. These consents apply only to the account of ' +
        'the person filling the form: a linked account created in the same call must sign its own ' +
        '(a consent is personal and can never be presumed from someone else).',
      example: [{ consentType: ConsentType.RGPD }, { consentType: ConsentType.CGU }],
    }),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(MAX_REGISTRATION_CONSENTS),
    ValidateNested({ each: true }),
    Type(() => CreateConsentDto),
  );
}

/**
 * Vérifie la cohérence de la liste de consentements transmise à l'inscription.
 * Retourne la liste des violations (vide si la liste est cohérente).
 *
 * Fonction pure, testable directement : la validation de FORME reste dans les
 * décorateurs class-validator, les règles portant sur la liste entière (qu'un
 * `@ValidateNested` ne sait pas exprimer) vivent ici — même découpage que
 * `checkLinkedAccountIntent`.
 */
export function checkRegistrationConsents(requestedConsents?: CreateConsentDto[]): string[] {
  if (!requestedConsents || requestedConsents.length === 0) return [];

  const seenConsentTypes = new Set<ConsentType>();
  const duplicatedConsentTypes = new Set<ConsentType>();

  for (const requestedConsent of requestedConsents) {
    if (seenConsentTypes.has(requestedConsent.consentType)) {
      duplicatedConsentTypes.add(requestedConsent.consentType);
    }
    seenConsentTypes.add(requestedConsent.consentType);
  }

  if (duplicatedConsentTypes.size === 0) return [];

  return [
    `consents contains duplicated consentType(s): ${[...duplicatedConsentTypes].join(', ')}. ` +
      'Each consent type must be sent at most once — a consent is recorded once, with one version. ' +
      'Use POST /consents afterwards to sign a new version.',
  ];
}

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getMetadataStorage } from 'class-validator';

/** Clé de métadonnée portant la classe de DTO attendue dans le corps de la requête. */
export const STRICT_BODY_DTO = 'strict-body-dto';

/**
 * Type minimal d'une classe de DTO (constructeur), sans imposer de forme.
 */
export type DtoClass = new (...constructorArguments: never[]) => object;

/**
 * Refuse explicitement (400) tout champ du corps de requête qui n'est pas déclaré
 * par le DTO de la route.
 *
 * Pourquoi un GUARD et non `forbidNonWhitelisted` sur la ValidationPipe :
 * la pipe globale (`src/main.ts`) applique `whitelist: true` et s'exécute AVANT
 * toute pipe de contrôleur, de méthode ou de paramètre — au moment où une pipe
 * plus spécifique reçoit le corps, les champs inconnus ont déjà été supprimés et
 * sont devenus indétectables. Un garde, lui, s'exécute avant les pipes et voit le
 * corps brut : c'est le seul point où la strictesse peut être appliquée route par
 * route sans activer `forbidNonWhitelisted` globalement (ce qui casserait
 * d'autres routes, cf. docs/services/identity-access-service.md, session
 * 2026-08-09 « consentements »).
 *
 * Motif : arbitrage d'architecture du 2026-08-09 — « aucune route ne doit
 * accepter puis ignorer un champ ; un champ non prévu doit être refusé
 * explicitement, jamais absorbé en silence ». C'est ce défaut qui avait fait
 * disparaître `loginIdentifier` sur `/accounts/parents`, puis les consentements
 * RGPD/CGU et `birthDate` sur `/accounts/students`.
 */
@Injectable()
export class RejectUnknownBodyFieldsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const dtoClass = this.reflector.get<DtoClass | undefined>(STRICT_BODY_DTO, context.getHandler());
    if (!dtoClass) return true;

    const requestBody: unknown = context.switchToHttp().getRequest().body;
    if (requestBody === null || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
      return true;
    }

    const declaredFieldNames = collectDeclaredFieldNames(dtoClass);
    const unknownFieldNames = Object.keys(requestBody).filter(
      (fieldName) => !declaredFieldNames.has(fieldName),
    );

    if (unknownFieldNames.length > 0) {
      throw new BadRequestException(
        `Unknown field(s) in request body: ${unknownFieldNames.join(', ')}. ` +
          `Accepted fields for this route: ${[...declaredFieldNames].sort().join(', ')}. ` +
          'A field this route does not know is rejected rather than silently dropped — ' +
          'send it to the service that owns it, or remove it.',
      );
    }

    return true;
  }
}

/**
 * Retourne les noms de propriétés déclarés par un DTO, tels que la ValidationPipe
 * les retient pour `whitelist` (toute propriété portant au moins un décorateur
 * class-validator, héritage compris).
 *
 * Échoue bruyamment si le DTO n'expose aucune propriété validée : ce serait le
 * signe d'un DTO sans décorateur, donc d'une route qui accepterait n'importe quoi
 * — exactement ce que ce garde existe pour empêcher.
 */
export function collectDeclaredFieldNames(dtoClass: DtoClass): Set<string> {
  const validationMetadatas = getMetadataStorage().getTargetValidationMetadatas(
    dtoClass,
    '',
    true,
    false,
  );
  const declaredFieldNames = new Set(validationMetadatas.map((metadata) => metadata.propertyName));

  if (declaredFieldNames.size === 0) {
    throw new Error(
      `${dtoClass.name} declares no class-validator decorated property: ` +
        'RejectUnknownBodyFieldsGuard cannot determine which fields are accepted.',
    );
  }

  return declaredFieldNames;
}

/**
 * Applique la strictesse ci-dessus à une route, en lui associant le DTO qui fait
 * foi. À poser sur toute route où un champ perdu est une perte de donnée métier
 * (création de compte, consentements).
 */
export function StrictBody(dtoClass: DtoClass) {
  return applyDecorators(SetMetadata(STRICT_BODY_DTO, dtoClass), UseGuards(RejectUnknownBodyFieldsGuard));
}

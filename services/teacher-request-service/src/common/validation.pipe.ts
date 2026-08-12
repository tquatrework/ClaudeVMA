import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';

/**
 * Traduit en francais le seul message que class-validator produit lui-meme :
 * celui du refus d'un champ inconnu. Tous les autres messages sont ecrits en
 * francais dans les DTO, au plus pres du champ qu'ils decrivent.
 */
function toFrenchMessages(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;
    const messages: string[] = [];

    if (error.constraints) {
      for (const [constraintName, message] of Object.entries(error.constraints)) {
        messages.push(
          constraintName === 'whitelistValidation'
            ? `Le champ « ${fieldPath} » n'est pas attendu par cette route.`
            : message,
        );
      }
    }
    if (error.children?.length) {
      messages.push(...toFrenchMessages(error.children, fieldPath));
    }
    return messages;
  });
}

/**
 * `forbidNonWhitelisted` est le point central de ce pipe.
 *
 * Sans lui, `whitelist: true` faisait DISPARAITRE en silence tout champ
 * inconnu : `{"subject":"X","urgency":"haute"}` repondait `201` en jetant
 * `urgency`, et le `description` envoye par le front etait absorbe avant meme
 * la validation — d'ou un `400 "subject must be a string"` incomprehensible sur
 * un corps qui contenait pourtant un texte. Meme defaut qu'arbitre le
 * 2026-08-09 pour `loginIdentifier` et les consentements : aucune route ne doit
 * accepter puis ignorer un champ.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) => new BadRequestException(toFrenchMessages(errors)),
  });
}

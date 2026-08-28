/**
 * Régression — POST /validations/:type/:id/decision (dont /validations/quiz/:id/decision)
 * renvoyait, pour toute valeur de `decision` invalide, un message d'erreur
 * dont l'énumération des valeurs acceptées était VIDE :
 *   "decision must be one of the following values: "
 *
 * Cause : `@IsEnum([ContentStatus.VALIDATED, ContentStatus.REJECTED])` — un
 * tableau littéral passé à `@IsEnum`, qui n'est prévu que pour un véritable
 * objet enum TS/JS. `class-validator` construit la liste affichée dans le
 * message via `validEnumValues()`, qui filtre les clés dont
 * `isNaN(parseInt(key))` est faux — pensé pour ignorer le mapping inverse
 * des enums numériques (`0: 'A', 'A': 0`). Sur un tableau, les clés sont
 * précisément des index numériques ('0', '1'), donc TOUTES filtrées : la
 * liste affichée est vide, quelle que soit la valeur réellement invalide
 * envoyée.
 *
 * La validation elle-même (accepter 'validated'/'rejected', rejeter le
 * reste) fonctionnait déjà correctement — seul le message était vide,
 * confondu à tort avec un refus systématique de toute décision.
 *
 * Correctif : `@IsIn(...)`, prévu pour un tableau de valeurs autorisées,
 * n'a pas ce défaut de filtrage.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidateContentDto } from '../../../src/validations/dto/validate-content.dto';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';

describe('ValidateContentDto — decision', () => {
  it('accepte "validated"', async () => {
    const dto = plainToInstance(ValidateContentDto, { decision: ContentStatus.VALIDATED });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepte "rejected" (avec commentaire, porté par la règle métier, pas par la DTO)', async () => {
    const dto = plainToInstance(ValidateContentDto, {
      decision: ContentStatus.REJECTED,
      comment: 'Motif du rejet',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejette une valeur de décision invalide avec un message listant les valeurs acceptées (pas une énumération vide)', async () => {
    const dto = plainToInstance(ValidateContentDto, { decision: 'approved' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    const [error] = errors;
    const messages = Object.values(error.constraints ?? {});
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message).toContain('validated');
      expect(message).toContain('rejected');
      expect(message).not.toMatch(/values:\s*$/);
    }
  });
});

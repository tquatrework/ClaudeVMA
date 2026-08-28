/**
 * Régression — GET /quizzes/pending-validation renvoyait 500 quand
 * page/limit n'étaient pas fournis dans la query.
 *
 * Cause : avec des paramètres déclarés individuellement
 * (`@Query('page') page?: number`), le `ValidationPipe` global
 * (`transform: true`) applique `transformPrimitive()` qui fait `+value`
 * pour convertir en `Number` — `+undefined` vaut `NaN`, pas `undefined`.
 * Les valeurs par défaut de `QuizzesService.getPendingValidation` (page = 1,
 * limit = 20) ne s'appliquent qu'à un argument strictement `undefined` :
 * `NaN` les court-circuite, `skip`/`take` deviennent `NaN`, et TypeORM lève
 * "Provided \"skip\" value is not a number." → 500.
 *
 * Le correctif fait transiter page/limit par une DTO dédiée
 * (`PendingValidationQueryDto`), sur le modèle de `SearchQuizDto` déjà
 * utilisé par `GET /quizzes` : un champ absent d'une DTO reste `undefined`
 * après transformation, il n'est jamais coercé en `NaN`.
 */

import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { PendingValidationQueryDto } from '../../../src/quizzes/dto/pending-validation-query.dto';

describe('PendingValidationQueryDto — pagination de GET /quizzes/pending-validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: PendingValidationQueryDto,
    data: undefined,
  };

  it('reproduit le mécanisme fautif : un Number primitif non fourni devient NaN, pas undefined', async () => {
    // Ceci est exactement ce que fait le ValidationPipe pour un paramètre
    // individuel `@Query('page') page?: number` — la forme abandonnée par
    // le correctif. On le garde ici en test de non-régression du
    // raisonnement : si quelqu'un revient à cette forme, ce test documente
    // pourquoi c'est cassé.
    const result = await pipe.transform(undefined, {
      type: 'query',
      metatype: Number,
      data: 'page',
    });
    expect(Number.isNaN(result)).toBe(true);
  });

  it('laisse page et limit undefined quand la query est vide (plus de NaN)', async () => {
    const result = await pipe.transform({}, metadata);
    expect(result.page).toBeUndefined();
    expect(result.limit).toBeUndefined();
  });

  it('convertit page et limit en nombres quand ils sont fournis en query string', async () => {
    const result = await pipe.transform({ page: '2', limit: '10' }, metadata);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('rejette une valeur non numérique plutôt que de la laisser produire un NaN silencieux', async () => {
    await expect(pipe.transform({ page: 'abc' }, metadata)).rejects.toThrow();
  });

  it('rejette une page inférieure à 1', async () => {
    await expect(pipe.transform({ page: '0' }, metadata)).rejects.toThrow();
  });
});

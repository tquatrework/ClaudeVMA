// Ce spec n'importe aucun module Nest : `reflect-metadata` doit donc être
// chargé explicitement, sans quoi les décorateurs de `@Type()` échouent.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  TeachersPageQueryDto,
  TEACHERS_PAGE_DEFAULT_LIMIT,
  TEACHERS_PAGE_DEFAULT_PAGE,
  TEACHERS_PAGE_MAX_LIMIT,
} from '../../../src/profiles/dto/teachers-page.query.dto';

/**
 * La query arrive toujours en chaînes de caractères : ces tests passent donc
 * par `plainToInstance`, comme le fait le `ValidationPipe({ transform: true })`
 * de `main.ts`, et non par une instanciation directe qui masquerait la
 * conversion.
 */
const parse = (query: Record<string, unknown>) =>
  plainToInstance(TeachersPageQueryDto, query, { enableImplicitConversion: false });

const errorsOf = (query: Record<string, unknown>) => validateSync(parse(query));

const messagesOf = (query: Record<string, unknown>) =>
  errorsOf(query).flatMap((error) => Object.values(error.constraints ?? {}));

describe('TeachersPageQueryDto', () => {
  describe('valeurs par défaut', () => {
    it('applique page 1 et la taille de page par défaut quand rien n\'est fourni', () => {
      const dto = parse({});

      expect(dto.page).toBe(TEACHERS_PAGE_DEFAULT_PAGE);
      expect(dto.limit).toBe(TEACHERS_PAGE_DEFAULT_LIMIT);
      expect(errorsOf({})).toHaveLength(0);
    });
  });

  describe('conversion depuis la chaîne de requête', () => {
    it('convertit les nombres transmis en texte', () => {
      const dto = parse({ page: '3', limit: '50' });

      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(50);
      expect(errorsOf({ page: '3', limit: '50' })).toHaveLength(0);
    });

    it('refuse une valeur non numérique', () => {
      expect(messagesOf({ page: 'deux' })).toContain(
        'Le numéro de page doit être un nombre entier.',
      );
    });

    it('refuse une valeur décimale', () => {
      expect(messagesOf({ limit: '2.5' })).toContain(
        'Le nombre de formateurs par page doit être un nombre entier.',
      );
    });
  });

  describe('bornes', () => {
    it('accepte la borne basse : page 1, limit 1', () => {
      expect(errorsOf({ page: '1', limit: '1' })).toHaveLength(0);
    });

    it(`accepte la borne haute : limit ${TEACHERS_PAGE_MAX_LIMIT}`, () => {
      expect(errorsOf({ limit: String(TEACHERS_PAGE_MAX_LIMIT) })).toHaveLength(0);
    });

    it('refuse page 0 — la pagination commence à 1', () => {
      expect(messagesOf({ page: '0' })).toContain('Le numéro de page commence à 1.');
    });

    it('refuse une page négative', () => {
      expect(messagesOf({ page: '-1' })).toHaveLength(1);
    });

    it('refuse limit 0', () => {
      expect(messagesOf({ limit: '0' })).toContain(
        'Le nombre de formateurs par page doit être au moins de 1.',
      );
    });
  });

  describe('plafond déclaré, jamais rogné en silence', () => {
    it(`refuse un limit au-dessus de ${TEACHERS_PAGE_MAX_LIMIT}`, () => {
      const messages = messagesOf({ limit: String(TEACHERS_PAGE_MAX_LIMIT + 1) });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(String(TEACHERS_PAGE_MAX_LIMIT));
    });

    it('annonce le plafond en français dans le message de refus', () => {
      expect(messagesOf({ limit: '1000' })[0]).toMatch(
        /ne peut pas dépasser 100.*pages suivantes/,
      );
    });

    it('ne ramène pas la demande au plafond : la valeur reste celle de l\'appelant', () => {
      // Le rognage silencieux ferait croire à l'appelant qu'il a tout reçu.
      expect(parse({ limit: '1000' }).limit).toBe(1000);
    });
  });
});

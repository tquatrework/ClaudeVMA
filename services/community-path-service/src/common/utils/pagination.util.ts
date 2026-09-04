import { BadRequestException } from '@nestjs/common';

/**
 * Convention de pagination du projet (voir docs/routes.md, ex. `GET /profiles/teachers/validated`
 * et `GET /profiles/directory/by-role`) : `page` par défaut 1, `limit` par défaut 20, plafond
 * explicite 100 — jamais rogné en silence, toujours refusé avec un message français citant la
 * limite. Première utilisation dans `community-path-service` (`GET /forums/:id/comments`).
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Parse et valide `page`/`limit` reçus en query string (toujours des chaînes ou `undefined`).
 * Refuse explicitement (400, message en français) toute valeur non entière, inférieure à 1, ou
 * dépassant `MAX_PAGE_LIMIT` — jamais une valeur ramenée en silence.
 */
export function parsePagination(pageRaw?: string, limitRaw?: string): Pagination {
  const page = pageRaw === undefined || pageRaw === '' ? DEFAULT_PAGE : Number(pageRaw);
  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestException('Le paramètre "page" doit être un entier supérieur ou égal à 1');
  }

  const limit = limitRaw === undefined || limitRaw === '' ? DEFAULT_PAGE_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new BadRequestException('Le paramètre "limit" doit être un entier supérieur ou égal à 1');
  }
  if (limit > MAX_PAGE_LIMIT) {
    throw new BadRequestException(
      `Le paramètre "limit" ne peut pas dépasser ${MAX_PAGE_LIMIT} (valeur reçue : ${limit})`,
    );
  }

  return { page, limit };
}

export function buildPaginatedResult<T>(data: T[], total: number, { page, limit }: Pagination): PaginatedResult<T> {
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}

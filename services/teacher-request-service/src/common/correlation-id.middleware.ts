import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Forme minimale de la requete utilisee ici. Declaree localement plutot
 * qu'importee d'express, dont les types ne font pas partie des dependances de
 * ce service.
 */
export interface RequestWithCorrelationId {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
}

interface ResponseWithHeaders {
  setHeader(name: string, value: string): void;
}

/**
 * Accepte, genere et renvoie `x-correlation-id`.
 *
 * Contrat technique du projet (`<contract id="correlation">`) : tous les appels
 * doivent accepter et propager cet en-tete. Il etait jusqu'ici purement ignore
 * par ce service, alors que la gateway le transmettait deja.
 *
 * L'en-tete est aussi RENVOYE dans la reponse : sans cela, un appelant qui n'en
 * fournit pas n'a aucun moyen de connaitre la correlation sous laquelle son
 * appel a ete trace.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelationId, response: ResponseWithHeaders, next: () => void): void {
    const inboundHeader = request.headers[CORRELATION_ID_HEADER];
    const inboundCorrelationId = Array.isArray(inboundHeader) ? inboundHeader[0] : inboundHeader;
    const correlationId = inboundCorrelationId?.trim() || randomUUID();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}

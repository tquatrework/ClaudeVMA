import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Nom de relation posé le 2026-08-11 ("Rattacher un AP à un formateur qu'il
 * anime") côté profile-service — proprietaire unique des relations.
 */
export const ANIMATOR_OF_TEACHER_RELATION_KIND = 'animator_of_teacher';

interface InternalRelation {
  kind?: string;
}

interface InternalRelationsResponse {
  relations?: InternalRelation[];
}

/**
 * Client interservices vers profile-service, réservé aux vérifications de
 * relation nécessaires à une règle métier portée par ce service (validation
 * AP scopée par relation animator_of_teacher, arbitrage du 2026-08-28 —
 * docs/architecture.md, "Edition d'un Quizz par son auteur...").
 *
 * Échec fermé : toute impossibilité de vérifier la relation (service
 * injoignable, réponse en erreur) lève ServiceUnavailableException plutôt
 * que d'accorder l'accès par défaut — même politique que le reste du projet.
 */
@Injectable()
export class ProfileRelationsClient {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('PROFILE_SERVICE_URL') ?? 'http://profile-service:3002';
  }

  private get internalSecret(): string | undefined {
    return this.config.get<string>('INTERNAL_SECRET');
  }

  /**
   * Vrai si `viewerId` (un AP) anime `targetId` (un formateur), d'après
   * profile-service. Un `targetId` inconnu de profile-service (404) est
   * traité comme "pas de relation", pas comme une panne.
   */
  async hasAnimatorOfTeacherRelation(viewerId: string, targetId: string): Promise<boolean> {
    const url = `${this.baseUrl}/internal/relations/${viewerId}/${targetId}?viewerRole=animateur_pedagogique`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Internal-Secret': this.internalSecret ?? '' },
      });
    } catch (error) {
      throw new ServiceUnavailableException('profile-service injoignable');
    }

    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('profile-service injoignable');
    }

    const body = (await response.json()) as InternalRelationsResponse;
    const relations = body?.relations ?? [];
    return relations.some((relation) => relation.kind === ANIMATOR_OF_TEACHER_RELATION_KIND);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Nom résolu d'une personne — jamais un UUID affiché à l'utilisateur
 * (arbitrage du 2026-08-09, appliqué ici à l'affichage de l'auteur d'un
 * commentaire/sujet de forum, arbitrage du 2026-09-04
 * "Affichage de l'auteur de chaque commentaire").
 */
export interface DisplayName {
  firstName: string | null;
  lastName: string | null;
}

/**
 * Client interne vers profile-service, limité à la résolution de nom par
 * lot — même mécanisme déjà repris par calendar-service, teacher-request-service,
 * video-session-service et dashboard-notification-service.
 *
 * Politique d'échec DÉLIBÉRÉMENT différente de celle retenue par
 * dashboard-notification-service (qui lève, car un événement de notification
 * doit être rejoué plutôt que produire un message sans nom) : ici, un échec
 * de profile-service (réseau, timeout, HTTP non-2xx) dégrade gracieusement —
 * les commentaires/sujets restent lisibles, seulement sans nom résolu
 * (`authorName: null`). Un blocage de la lecture d'un fil de discussion pour
 * ce seul motif serait disproportionné ; jamais de secours sur l'UUID en
 * revanche (règle non négociable).
 */
@Injectable()
export class ProfileServiceClient {
  private readonly logger = new Logger(ProfileServiceClient.name);
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  private readonly requestTimeoutMs = 3000;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('PROFILE_SERVICE_URL');
    this.internalSecret = config.getOrThrow<string>('INTERNAL_SECRET');
  }

  /**
   * Résout prénom/nom pour un lot d'identifiants via
   * `POST /internal/profiles/display-names`. Un identifiant absent de la
   * réponse de profile-service (anomalie de données, ou compte sans profil
   * administratif) est simplement absent de la Map renvoyée — l'appelant
   * doit traiter une entrée manquante comme `authorName: null`, jamais
   * fabriquer un nom.
   *
   * Dégradation gracieuse : toute erreur (réseau, timeout, HTTP non-2xx)
   * renvoie une Map vide plutôt que de lever — voir la politique documentée
   * sur la classe.
   */
  async resolveDisplayNames(userIds: string[]): Promise<Map<string, DisplayName>> {
    const uniqueIds = [...new Set(userIds)];
    const map = new Map<string, DisplayName>();
    if (uniqueIds.length === 0) {
      return map;
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/internal/profiles/display-names`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        body: JSON.stringify({ userIds: uniqueIds }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `Résolution de noms refusée par profile-service (HTTP ${response.status}) — noms omis, lecture non bloquée.`,
        );
        return map;
      }

      const body = (await response.json()) as {
        displayNames?: Array<{ userId: string; firstName: string | null; lastName: string | null }>;
      };
      for (const entry of body.displayNames ?? []) {
        map.set(entry.userId, { firstName: entry.firstName, lastName: entry.lastName });
      }
      return map;
    } catch (error) {
      this.logger.warn(
        `profile-service injoignable pour la résolution de noms : ${(error as Error).message} — noms omis, lecture non bloquée.`,
      );
      return map;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

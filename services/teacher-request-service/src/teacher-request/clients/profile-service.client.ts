import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Une relation metier entre deux personnes, telle que profile-service la decrit. */
export interface ProfileRelation {
  kind: string;
  isPrincipalTeacher?: boolean;
  throughUserIds?: string[];
}

/** Reponse de `GET /internal/relations/:viewerId/:targetId`. */
export interface RelationLookup {
  viewerId: string;
  targetId: string;
  isSelf: boolean;
  isAdministrator: boolean;
  relations: ProfileRelation[];
}

/** Contexte technique propage a chaque appel sortant. */
export interface OutboundCallContext {
  correlationId?: string;
  /** En-tete `Authorization` de l'appelant, relaye pour les lectures de profil. */
  callerAuthorization?: string;
}

const PROFILE_CALL_TIMEOUT_MS = 3000;

/**
 * Adaptateur type des appels a profile-service.
 *
 * Trois usages, avec trois politiques d'echec DIFFERENTES et assumees :
 *
 * 1. `resolveDisplayName` — confort d'affichage : un echec renvoie `null`.
 *    Attention, `null` n'autorise jamais a retomber sur un UUID cote reponse
 *    (arbitrage du 2026-08-09 : aucun UUID lu par un utilisateur).
 * 2. `getRelations` — regle de droit : un echec REFUSE l'action. Une
 *    verification de lien qui echoue en laissant passer serait pire que pas de
 *    verification, puisqu'elle donnerait l'illusion du controle.
 * 3. `createTeacherStudentRelation` — ecriture metier : un echec fait echouer
 *    la validation du RP. Le lien eleve↔formateur appartient a profile-service
 *    (arbitrage du 2026-08-12, point 5) ; une demande cloturee sans lien cree
 *    serait une erreur metier transformee en succes technique.
 */
@Injectable()
export class ProfileServiceClient {
  private readonly logger = new Logger(ProfileServiceClient.name);
  private readonly baseUrl: string;
  private readonly internalSecret: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('PROFILE_SERVICE_URL');
    this.internalSecret = config.getOrThrow<string>('INTERNAL_SECRET');
  }

  private buildHeaders(context: OutboundCallContext, extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (context.correlationId) headers['x-correlation-id'] = context.correlationId;
    return headers;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), PROFILE_CALL_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: abortController.signal });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Resout « Prenom Nom » pour un identifiant donne.
   *
   * Deux chemins, dans cet ordre :
   * 1. la route interne dediee, qui n'a pas besoin d'un lecteur autorise — le
   *    formateur destinataire d'une proposition doit lire le nom de l'eleve
   *    alors qu'aucune relation ne les lie encore ;
   * 2. a defaut, la route publique avec le jeton de l'appelant, qui applique
   *    ses propres droits de lecture.
   */
  async resolveDisplayName(userId: string, context: OutboundCallContext = {}): Promise<string | null> {
    const fromInternalRoute = await this.readNameFromInternalRoute(userId, context);
    if (fromInternalRoute !== null) return fromInternalRoute;
    return this.readNameFromPublicRoute(userId, context);
  }

  private async readNameFromInternalRoute(
    userId: string,
    context: OutboundCallContext,
  ): Promise<string | null> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/internal/profiles/${userId}/display-name`, {
        headers: this.buildHeaders(context, { 'X-Internal-Secret': this.internalSecret }),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { firstName?: string | null; lastName?: string | null };
      return `${payload.firstName ?? ''} ${payload.lastName ?? ''}`.trim() || null;
    } catch (error) {
      this.logger.warn(`Nom introuvable (route interne) pour ${userId} : ${(error as Error).message}`);
      return null;
    }
  }

  private async readNameFromPublicRoute(userId: string, context: OutboundCallContext): Promise<string | null> {
    if (!context.callerAuthorization) return null;
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/profiles/${userId}`, {
        headers: this.buildHeaders(context, { authorization: context.callerAuthorization }),
      });
      if (!response.ok) return null;
      // `GET /profiles/:userId` renvoie une ENVELOPPE {userId, administrative,
      // pedagogical, ...} : lire `firstName` a la racine, comme le faisait la
      // version precedente, renvoyait toujours `undefined`.
      const payload = (await response.json()) as {
        administrative?: { firstName?: string | null; lastName?: string | null } | null;
      };
      const administrative = payload.administrative;
      if (!administrative) return null;
      return `${administrative.firstName ?? ''} ${administrative.lastName ?? ''}`.trim() || null;
    } catch (error) {
      this.logger.warn(`Nom introuvable (route publique) pour ${userId} : ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Lit la nature et le sens des relations entre deux personnes.
   *
   * profile-service reste l'unique proprietaire des relations : ce service les
   * lui demande a CHAQUE action et n'en garde aucune copie (arbitrages du
   * 2026-08-11 et du 2026-08-12). Un lien peut etre rompu entre deux appels.
   */
  async getRelations(
    viewerId: string,
    targetId: string,
    viewerRole: string,
    context: OutboundCallContext = {},
  ): Promise<RelationLookup> {
    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${this.baseUrl}/internal/relations/${viewerId}/${targetId}?viewerRole=${encodeURIComponent(viewerRole)}`,
        { headers: this.buildHeaders(context, { 'X-Internal-Secret': this.internalSecret }) },
      );
    } catch (error) {
      this.logger.error(`Verification de lien impossible (${viewerId} → ${targetId}) : ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Le service des profils est momentanement injoignable : impossible de verifier vos droits sur cet eleve.",
      );
    }

    if (!response.ok) {
      this.logger.error(`Verification de lien refusee (${viewerId} → ${targetId}) : HTTP ${response.status}`);
      throw new ServiceUnavailableException(
        "Le service des profils n'a pas pu confirmer vos droits sur cet eleve.",
      );
    }
    return (await response.json()) as RelationLookup;
  }

  /**
   * Cree le lien eleve↔formateur, propriete de profile-service.
   *
   * Le `409` renvoye sur doublon est traite comme un succes : le lien demande
   * existe, l'intention de l'appelant est satisfaite. C'est ce qui rend la
   * validation du RP rejouable sans creer de doublon.
   */
  async createTeacherStudentRelation(
    link: { teacherId: string; studentId: string; isPrincipalTeacher: boolean },
    context: OutboundCallContext = {},
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${this.baseUrl}/internal/create-teacher-student-relation`, {
        method: 'POST',
        headers: this.buildHeaders(context, {
          'X-Internal-Secret': this.internalSecret,
          'content-type': 'application/json',
        }),
        body: JSON.stringify(link),
      });
    } catch (error) {
      this.logger.error(`Creation du lien eleve↔formateur impossible : ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Le service des profils est momentanement injoignable : le lien entre l'eleve et le formateur n'a pas pu etre cree.",
      );
    }

    if (response.status === 409) {
      this.logger.log(`Lien eleve↔formateur deja existant (${link.teacherId} ↔ ${link.studentId})`);
      return;
    }
    if (!response.ok) {
      this.logger.error(`Creation du lien eleve↔formateur refusee : HTTP ${response.status}`);
      throw new ServiceUnavailableException(
        "Le lien entre l'eleve et le formateur n'a pas pu etre cree : la demande reste ouverte.",
      );
    }
  }
}

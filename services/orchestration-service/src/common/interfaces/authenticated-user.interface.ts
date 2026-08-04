/**
 * Représente l'acteur authentifié tel qu'extrait du JWT par JwtAuthGuard.
 * Utilisé partout où un contrôleur ou un service a besoin de connaître
 * l'utilisateur à l'origine d'une requête (jamais `req.user: any`).
 */
export interface AuthenticatedUser {
  id: string;
  loginIdentifier: string;
  email: string;
  role: string;
  validationStatus: string;
  jti: string;
}

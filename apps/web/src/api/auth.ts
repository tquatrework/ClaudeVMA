/**
 * Module API — auth (identity-access-service)
 *
 * Réinitialisation de mot de passe et récupération d'identifiant de connexion.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écarts signalés (non documentés dans docs/routes.md, qui ne recense pour
 * /auth que login, logout, refresh et me — comportement runtime préservé
 * tel quel, voir rapport de migration du lot) :
 * - POST /auth/password-reset/request
 * - POST /auth/recover-identifier
 */

import apiClient from './client'

/**
 * POST /auth/password-reset/request — Demander un lien de réinitialisation de mot de passe
 */
export async function requestPasswordReset(loginIdentifier: string): Promise<void> {
  await apiClient.post('/auth/password-reset/request', { loginIdentifier })
}

/**
 * POST /auth/recover-identifier — Demander la récupération de son identifiant de connexion
 */
export async function recoverIdentifier(email: string): Promise<void> {
  await apiClient.post('/auth/recover-identifier', { email })
}

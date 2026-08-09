/**
 * registrationError — traduction des erreurs de `POST /accounts/students` et
 * `POST /accounts/parents` en message lisible par la famille qui s'inscrit.
 *
 * Ces deux routes créent potentiellement **deux** comptes en un seul appel. Un
 * `409` peut donc porter sur l'identifiant de connexion du compte principal ou
 * sur celui du compte lié : dire simplement « identifiant déjà pris » laisserait
 * l'utilisateur corriger le mauvais champ. Ce module détermine, à partir du mode
 * de liaison déclaré et du message serveur, lequel des deux est en cause.
 *
 * Cas couverts (voir docs/routes.md > identity-access-service > Comptes) :
 * - `409` identifiant de connexion déjà pris (compte principal ou compte lié) ;
 * - `404` compte à rattacher introuvable (mode `existing` uniquement) ;
 * - `400` champs de liaison incohérents avec le mode déclaré ;
 * - tout le reste retombe sur `getErrorMessage`.
 */

import type { LinkedAccountMode, LinkedAccountRelation } from '../types/accounts'
import { getErrorMessage, getErrorStatus } from './apiError'
import { LINKED_ACCOUNT_LABELS } from './accountLinking'

/** Compte visé par une erreur d'identifiant déjà pris. */
export type ConflictingAccount = 'main' | 'linked' | 'unknown'

export interface RegistrationErrorContext {
  /** Nature du compte lié à celui en cours de création. */
  relation: LinkedAccountRelation
  /** Intention de liaison réellement transmise au serveur. */
  linkedAccountMode: LinkedAccountMode
  /** Identifiant de connexion saisi pour le compte principal (vide = dérivé par le serveur). */
  mainLoginIdentifier?: string
  /** Identifiant de connexion saisi pour le compte lié. */
  linkedLoginIdentifier?: string
}

/** Sous-ensemble des payloads d'inscription utile au diagnostic d'erreur. */
export interface RegistrationPayloadFields {
  loginIdentifier?: string
  parentAccountMode?: LinkedAccountMode
  parentLoginIdentifier?: string
  studentAccountMode?: LinkedAccountMode
  studentLoginIdentifier?: string
}

/**
 * Dérive le contexte de diagnostic du payload réellement envoyé, plutôt que de
 * le reconstruire à la main côté page : le message affiché ne peut donc pas
 * décrire une intention différente de celle transmise au serveur.
 */
export function buildRegistrationErrorContext(
  relation: LinkedAccountRelation,
  payload: RegistrationPayloadFields,
): RegistrationErrorContext {
  const isParentRelation = relation === 'parent'
  return {
    relation,
    linkedAccountMode:
      (isParentRelation ? payload.parentAccountMode : payload.studentAccountMode) ?? 'none',
    mainLoginIdentifier: payload.loginIdentifier,
    linkedLoginIdentifier: isParentRelation
      ? payload.parentLoginIdentifier
      : payload.studentLoginIdentifier,
  }
}

function readBackendMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.filter((part) => typeof part === 'string').join(' ')
  return ''
}

function quote(value?: string): string {
  const trimmed = value?.trim()
  return trimmed ? ` « ${trimmed} »` : ''
}

/**
 * Détermine quel compte porte l'identifiant déjà pris.
 *
 * Raisonnement, du plus sûr au plus heuristique :
 * 1. hors mode `new`, aucun compte lié n'est créé → le conflit ne peut venir que
 *    du compte principal ;
 * 2. en mode `new`, si l'utilisateur n'a pas choisi son propre identifiant, le
 *    serveur le dérive de l'email en suffixant en cas de collision : il ne
 *    provoque jamais de `409` → le conflit vient du compte lié ;
 * 3. sinon, on cherche dans le message serveur la valeur en cause, puis le nom
 *    du champ (`parentLoginIdentifier` / `studentLoginIdentifier`) ;
 * 4. à défaut de signal, on ne tranche pas plutôt que d'orienter à tort.
 */
export function resolveConflictingAccount(
  error: unknown,
  context: RegistrationErrorContext,
): ConflictingAccount {
  if (context.linkedAccountMode !== 'new') return 'main'

  const mainLoginIdentifier = context.mainLoginIdentifier?.trim().toLowerCase() ?? ''
  if (!mainLoginIdentifier) return 'linked'

  const backendMessage = readBackendMessage(error).toLowerCase()
  const linkedLoginIdentifier = context.linkedLoginIdentifier?.trim().toLowerCase() ?? ''

  if (linkedLoginIdentifier && backendMessage.includes(linkedLoginIdentifier)) return 'linked'
  if (backendMessage.includes(mainLoginIdentifier)) return 'main'
  if (backendMessage.includes(`${context.relation}loginidentifier`)) return 'linked'

  return 'unknown'
}

/**
 * Traduit une erreur d'inscription en message lisible, en distinguant le compte
 * principal du compte lié quand c'est possible.
 *
 * @param fallback message par défaut propre à la page appelante.
 */
export function getRegistrationErrorMessage(
  error: unknown,
  context: RegistrationErrorContext,
  fallback?: string,
): string {
  const status = getErrorStatus(error)
  const { target } = LINKED_ACCOUNT_LABELS[context.relation]
  const hasLinkedAccount = context.linkedAccountMode !== 'none'

  if (status === 409) {
    const conflictingAccount = resolveConflictingAccount(error, context)

    if (conflictingAccount === 'linked') {
      return `L'identifiant de connexion${quote(context.linkedLoginIdentifier)} du compte ${target} lié est déjà utilisé. Choisissez-en un autre.`
    }
    if (conflictingAccount === 'main') {
      return `L'identifiant de connexion${quote(context.mainLoginIdentifier)} est déjà utilisé. Choisissez-en un autre.`
    }
    return `L'un des identifiants de connexion saisis est déjà utilisé. Vérifiez le vôtre et celui du compte ${target} lié.`
  }

  if (status === 404 && context.linkedAccountMode === 'existing') {
    return `Aucun compte ${target} ne correspond à l'identifiant${quote(context.linkedLoginIdentifier)}. Vérifiez-le, ou choisissez de créer un nouveau compte ${target} lié.`
  }

  if (status === 400 && hasLinkedAccount) {
    return `Les informations du compte ${target} lié sont incomplètes ou incohérentes. Vérifiez la section « Lier un compte ${target} ».`
  }

  return getErrorMessage(error, fallback)
}

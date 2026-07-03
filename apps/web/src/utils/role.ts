/**
 * Utilitaires de rôle — centralisés
 *
 * Mapping rôle → libellé lisible
 * Mapping rôle → classe CSS d'accent
 */

import type { UserRole } from '../types/user'

/** Libellé lisible par rôle (interface utilisateur) */
export const ROLE_LABELS: Record<UserRole, string> = {
  eleve: 'Élève',
  parent_financeur: 'Parent / financeur',
  formateur: 'Formateur',
  animateur_pedagogique: 'Animateur pédagogique',
  responsable_pedagogique: 'Responsable pédagogique',
  technicien_informatique: 'Technicien informatique',
  administrateur_financier: 'Administrateur financier',
}

/** Classe CSS d'accent par rôle (correspondant aux tokens tokens.css) */
export const ROLE_ACCENT_CLASS: Record<UserRole, string> = {
  eleve: 'role-eleve',
  parent_financeur: 'role-parent',
  formateur: 'role-formateur',
  animateur_pedagogique: 'role-ap',
  responsable_pedagogique: 'role-rp',
  technicien_informatique: 'role-ti',
  administrateur_financier: 'role-af',
}

/**
 * Retourne le libellé lisible d'un rôle.
 * Fallback sur la valeur brute si le rôle est inconnu.
 */
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role
}

/**
 * Retourne la classe CSS d'accent pour un rôle.
 */
export function getRoleAccentClass(role: UserRole): string {
  return ROLE_ACCENT_CLASS[role] ?? 'role-eleve'
}

/**
 * Génère les initiales d'un nom affiché.
 * Ex : "Marie Dupont" → "MD" ; "Marie" → "M"
 */
export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  if (parts.length === 0 || displayName.trim() === '') return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Génère la première lettre d'un nom pour les avatars simples.
 */
export function getAvatarLetter(displayName?: string): string {
  if (!displayName) return '?'
  return displayName.charAt(0).toUpperCase()
}

import { useAuth } from './useAuth'
import type { UserRole } from '../context/AuthContext'

interface RoleAccent {
  /** CSS class à poser sur le shell pour activer l'accent du rôle */
  accentClass: string
  /** Valeur hex de fallback pour les navigateurs sans oklch */
  accentHex: string
}

const ROLE_ACCENT_MAP: Record<UserRole, RoleAccent> = {
  eleve: { accentClass: 'role-eleve', accentHex: '#5b6cf0' },
  parent_financeur: { accentClass: 'role-parent', accentHex: '#2fa8c8' },
  formateur: { accentClass: 'role-formateur', accentHex: '#2da06a' },
  responsable_pedagogique: { accentClass: 'role-rp', accentHex: '#9b35a0' },
  animateur_pedagogique: { accentClass: 'role-ap', accentHex: '#d97b0a' },
  administrateur_financier: { accentClass: 'role-af', accentHex: '#5a6580' },
  technicien_informatique: { accentClass: 'role-ti', accentHex: '#3d4a68' },
}

const DEFAULT_ACCENT: RoleAccent = { accentClass: 'role-eleve', accentHex: '#5b6cf0' }

/**
 * Retourne la classe CSS d'accent et la couleur hex de fallback
 * correspondant au rôle de l'utilisateur connecté.
 * Utilisé par Layout pour appliquer dynamiquement le thème par rôle.
 */
export function useRoleAccent(): RoleAccent {
  const { user } = useAuth()

  if (!user) return DEFAULT_ACCENT

  return ROLE_ACCENT_MAP[user.role] ?? DEFAULT_ACCENT
}

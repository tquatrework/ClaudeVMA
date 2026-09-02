/**
 * PersonTile — tuile générique présentant une personne (élève, parent, professeur, AP…).
 *
 * Extraite le 2026-09-02 de la carte élève de `ParentDashboardPage` (« Mes élèves ») — c'est la
 * tuile de référence demandée par l'orchestrateur pour la reconstruction du rail RP
 * (`docs/architecture.md` > « Reconstruction du rail gauche du Responsable Pédagogique (RP) »,
 * précision « Visualisation doit couvrir les 4 rôles ») : « Réutilise le composant de tuile déjà
 * existant qui présente un élève à son parent financeur — ne construis pas un nouveau composant
 * de tuile depuis zéro. » Cette tuile n'existait qu'en JSX inline dans `ParentDashboardPage` ;
 * elle est extraite ici pour être réellement réutilisable, sans changer son apparence.
 *
 * Règle du projet respectée : jamais l'identifiant technique (UUID) affiché comme libellé —
 * seul `displayName` (prénom + nom, déjà résolu par l'appelant) est affiché ; `userId` (si fourni)
 * ne sert qu'à construire les liens d'action.
 *
 * **Photo optionnelle (`photoUserId`), ajoutée le 2026-09-02** pour l'écran « Visualisation » du
 * rail RP (`GET /profiles/directory/by-role` porte un `avatarUrl` par entrée, `docs/routes.md`).
 * `avatarUrl` n'est jamais directement utilisable comme `src` d'image (route de lecture
 * authentifiée) : la tuile réutilise `useReadOnlyAvatar` — même mécanisme déjà éprouvé pour
 * afficher la photo d'un tiers ailleurs dans ce projet (tuile « Mon professeur » du dashboard
 * élève) — pour résoudre `photoUserId` en objet URL, avec dégradation silencieuse vers les
 * initiales sur 403/404/absence de photo. `ParentDashboardPage` ne passe pas ce prop
 * aujourd'hui (son `StudentCard` ne porte pas `avatarUrl`) : la tuile continue d'afficher les
 * initiales pour cet appelant, sans changement de comportement.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { useReadOnlyAvatar } from '../../hooks/profile/useReadOnlyAvatar'

export interface PersonTileAction {
  label: string
  to?: string
  onClick?: () => void
}

interface PersonTileProps {
  displayName: string
  /** Ligne secondaire optionnelle (identifiant de connexion, expertise…), jamais un UUID. */
  subtitle?: string | null
  actions: PersonTileAction[]
  /** Contenu additionnel optionnel (ex. « prochain cours ») rendu entre l'en-tête et les actions. */
  children?: React.ReactNode
  /**
   * Identifiant de la personne dont on tente d'afficher la photo — `undefined` (ou omis) pour
   * rester aux initiales, sans aucun appel réseau. Jamais affiché : sert uniquement à résoudre
   * `GET /profiles/:userId/avatar` via `useReadOnlyAvatar`.
   */
  photoUserId?: string
}

export function PersonTile({ displayName, subtitle, actions, children, photoUserId }: PersonTileProps) {
  const { photoObjectUrl } = useReadOnlyAvatar(photoUserId)

  return (
    <div
      style={{ boxShadow: 'var(--shadow-card)' }}
      className="bg-[var(--color-white)] border border-[var(--color-surface)] rounded-[var(--radius-card)] p-5"
    >
      {/* En-tête tuile */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-[16px] shrink-0 overflow-hidden">
          {photoObjectUrl ? (
            <img src={photoObjectUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[color:var(--color-ink)] m-0">
            {displayName}
          </p>
          {subtitle && (
            <p className="text-[11px] text-[color:var(--color-text-secondary)] m-0">{subtitle}</p>
          )}
        </div>
      </div>

      {children}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {actions.map((action) =>
          action.to ? (
            <Link
              key={action.label}
              to={action.to}
              className="text-[12px] text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-[5px] px-3 no-underline font-medium"
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="text-[12px] text-[color:var(--accent)] border border-[var(--color-surface)] rounded-[var(--radius-pill)] py-[5px] px-3 font-medium"
            >
              {action.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

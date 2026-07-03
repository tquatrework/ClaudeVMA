/**
 * GamesPage — Jeux pédagogiques mathématiques
 *
 * Page statique présentant des ressources externes de jeux et d'exercices
 * mathématiques accessibles librement en ligne.
 * Tous les liens s'ouvrent dans un nouvel onglet.
 * Aucun appel API — données statiques uniquement.
 */

import React from 'react'
import Layout from '../components/Layout'

interface ExternalGameResource {
  id: string
  name: string
  description: string
  url: string
  category: string
  ageRange: string
}

const GAME_RESOURCES: ExternalGameResource[] = [
  {
    id: 'khan-academy',
    name: 'Khan Academy',
    description:
      'Exercices interactifs et vidéos pédagogiques couvrant toutes les notions mathématiques du primaire au lycée. Progression personnalisée et suivi de maîtrise.',
    url: 'https://fr.khanacademy.org/math',
    category: 'Exercices interactifs',
    ageRange: 'Tous niveaux',
  },
  {
    id: 'mathador',
    name: 'Mathador',
    description:
      'Jeu de calcul mental basé sur les quatre opérations. Idéal pour développer la rapidité et la fluidité arithmétique de façon ludique.',
    url: 'https://www.mathador.fr',
    category: 'Calcul mental',
    ageRange: 'CE1 → 3e',
  },
  {
    id: 'prodigy-math',
    name: 'Prodigy Math',
    description:
      'Jeu de rôle en ligne où les élèves progressent en résolvant des problèmes mathématiques adaptés à leur niveau. Très engageant pour les collégiens.',
    url: 'https://www.prodigygame.com',
    category: 'Jeu de rôle pédagogique',
    ageRange: 'CE2 → 4e',
  },
  {
    id: 'geogebra',
    name: 'GeoGebra',
    description:
      'Suite d\'outils interactifs pour la géométrie, l\'algèbre, le calcul et les statistiques. Nombreuses simulations et activités disponibles gratuitement.',
    url: 'https://www.geogebra.org/activities',
    category: 'Géométrie & Algèbre',
    ageRange: '6e → Terminale',
  },
  {
    id: 'mangahigh',
    name: 'Mangahigh',
    description:
      'Plateforme de jeux mathématiques couvrant de nombreux thèmes : fractions, probabilités, équations… avec des défis et tournois.',
    url: 'https://www.mangahigh.com',
    category: 'Jeux variés',
    ageRange: 'CE1 → Seconde',
  },
  {
    id: 'cool-math-games',
    name: 'CoolMathGames',
    description:
      'Collection de jeux de logique, de stratégie et de mathématiques accessibles depuis le navigateur. Interface simple et contenu ludique.',
    url: 'https://www.coolmathgames.com',
    category: 'Logique & Stratégie',
    ageRange: 'Primaire → Collège',
  },
  {
    id: 'numeracy-ninjas',
    name: 'NRICH Maths',
    description:
      'Ressources de l\'Université de Cambridge proposant des problèmes riches et des défis mathématiques stimulants pour approfondir la réflexion.',
    url: 'https://nrich.maths.org',
    category: 'Problèmes enrichissants',
    ageRange: 'Tous niveaux',
  },
  {
    id: 'calculmatice',
    name: 'Calcul@tice',
    description:
      'Jeux d\'entraînement au calcul mental en ligne : addition, soustraction, multiplication, division. Interface simple et exercices progressifs.',
    url: 'https://www.calculatice.fr',
    category: 'Calcul mental',
    ageRange: 'CP → CM2',
  },
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Exercices interactifs': { bg: '#ede9fe', text: '#5b21b6' },
  'Calcul mental':         { bg: '#dbeafe', text: '#1e40af' },
  'Jeu de rôle pédagogique': { bg: '#dcfce7', text: '#14532d' },
  'Géométrie & Algèbre':   { bg: '#fef3c7', text: '#78350f' },
  'Jeux variés':           { bg: '#fce7f3', text: '#831843' },
  'Logique & Stratégie':   { bg: '#e0f2fe', text: '#0c4a6e' },
  'Problèmes enrichissants': { bg: '#f0fdf4', text: '#166534' },
}

function getCategoryStyle(category: string): { bg: string; text: string } {
  return CATEGORY_COLORS[category] ?? { bg: '#f3f4f6', text: '#374151' }
}

export default function GamesPage() {
  return (
    <Layout>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* En-tête */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--color-ink)',
              marginBottom: '8px',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Jeux pédagogiques
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Une sélection de ressources mathématiques gratuites et accessibles en ligne.
            Chaque lien ouvre le site tiers dans un nouvel onglet.
          </p>
        </div>

        {/* Grille de cartes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}
        >
          {GAME_RESOURCES.map((resource) => {
            const categoryStyle = getCategoryStyle(resource.category)
            return (
              <div
                key={resource.id}
                style={{
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-card)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow =
                    'var(--shadow-card-hover)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'
                }}
              >
                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      background: categoryStyle.bg,
                      color: categoryStyle.text,
                    }}
                  >
                    {resource.category}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      background: '#f3f4f6',
                      color: '#6b7280',
                    }}
                  >
                    {resource.ageRange}
                  </span>
                </div>

                {/* Titre */}
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--color-ink)',
                    margin: 0,
                  }}
                >
                  {resource.name}
                </h2>

                {/* Description */}
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {resource.description}
                </p>

                {/* Lien */}
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-field)',
                    border: '1px solid var(--accent)',
                    alignSelf: 'flex-start',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    const anchor = e.currentTarget as HTMLAnchorElement
                    anchor.style.background = 'var(--accent)'
                    anchor.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    const anchor = e.currentTarget as HTMLAnchorElement
                    anchor.style.background = 'transparent'
                    anchor.style.color = 'var(--accent)'
                  }}
                >
                  Accéder
                  <span aria-hidden="true" style={{ fontSize: '12px' }}>
                    &rarr;
                  </span>
                </a>
              </div>
            )
          })}
        </div>

        {/* Note de bas de page */}
        <p
          style={{
            marginTop: '32px',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Ces ressources sont des sites tiers indépendants de VisioMath.
          VisioMath n'est pas responsable de leur contenu.
        </p>
      </div>
    </Layout>
  )
}

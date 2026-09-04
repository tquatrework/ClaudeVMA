/**
 * MarkdownText — rend un texte Markdown de confiance modérée (rédigé par un RP/TI, jamais par un
 * utilisateur final anonyme) en éléments React réels, jamais via `dangerouslySetInnerHTML`.
 *
 * S'appuie sur `react-markdown` (parseur `remark`, CommonMark) : le HTML brut éventuellement
 * présent dans le texte source n'est **jamais** interprété — `react-markdown` ne rend du HTML que
 * si le plugin `rehype-raw` est explicitement ajouté, ce qui n'est pas le cas ici. Le texte est
 * donc échappé par défaut, conformément à la règle de sécurité du projet : aucun assainissement
 * manuel supplémentaire n'est nécessaire, et aucun mécanisme d'injection HTML n'est jamais
 * atteignable depuis ce composant.
 *
 * Premier usage : la charte de bonne conduite des forums (`docs/routes.md` >
 * « community-path-service » > « Charte de bonne conduite »). Générique — réutilisable pour tout
 * autre texte Markdown rédigé côté application plutôt que saisi par un utilisateur final non
 * modéré.
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownTextProps {
  content: string
  className?: string
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  return (
    <div className={className ?? 'space-y-3 text-sm text-gray-700'}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-gray-900 mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-gray-900 mt-4 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-900 mt-3 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

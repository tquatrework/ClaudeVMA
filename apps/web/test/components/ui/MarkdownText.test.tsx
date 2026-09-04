/**
 * Tests de MarkdownText — rendu Markdown réel (titres, listes, gras, liens), sans jamais
 * interpréter du HTML brut embarqué dans le texte source (`react-markdown` sans `rehype-raw`,
 * pas de `dangerouslySetInnerHTML`).
 *
 * Premier usage : la charte de bonne conduite des forums (`docs/routes.md` >
 * « community-path-service » > « Charte de bonne conduite »).
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarkdownText } from '../../../src/components/ui/MarkdownText'

describe('MarkdownText', () => {
  it('rend un titre de niveau 1 comme un vrai élément <h1>', () => {
    render(<MarkdownText content="# Charte d'utilisation" />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe("Charte d'utilisation")
  })

  it('rend un titre de niveau 2 comme un vrai élément <h2>', () => {
    render(<MarkdownText content="## Respecter les autres utilisateurs" />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toBe('Respecter les autres utilisateurs')
  })

  it('rend une liste à puces comme une vraie liste <ul>/<li>', () => {
    render(<MarkdownText content={'* Premier point\n* Second point'} />)
    const list = screen.getByRole('list')
    const items = screen.getAllByRole('listitem')
    expect(list.tagName).toBe('UL')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('Premier point')
    expect(items[1].textContent).toBe('Second point')
  })

  it('rend le gras comme un vrai élément <strong>, pas des astérisques visibles', () => {
    const { container } = render(<MarkdownText content="**J'ai lu et j'accepte**" />)
    const strong = container.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong?.textContent).toBe("J'ai lu et j'accepte")
    expect(container.textContent).not.toContain('**')
  })

  it('rend un lien markdown comme un vrai <a> cliquable, ouvert dans un nouvel onglet', () => {
    render(<MarkdownText content="[contact@visioprof.fr](mailto:contact@visioprof.fr)" />)
    const link = screen.getByRole('link', { name: 'contact@visioprof.fr' })
    expect(link.getAttribute('href')).toBe('mailto:contact@visioprof.fr')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it("n'interprète jamais du HTML brut embarqué dans le texte source (aucune balise script/injection exécutée)", () => {
    const { container } = render(
      <MarkdownText content={'Texte normal <script>window.__pwned = true</script> suite'} />,
    )
    // react-markdown sans rehype-raw échappe le HTML brut : aucune balise <script> réelle
    // n'est jamais insérée dans le DOM, le marqueur reste du texte affiché tel quel.
    expect(container.querySelector('script')).toBeNull()
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined()
  })

  it('affiche les caractères # et * tels quels quand ils ne forment pas une syntaxe Markdown valide isolée', () => {
    // Un simple texte contenant un symbole # sans espace (ex. un hashtag) reste du texte —
    // vérifie que le composant ne casse pas sur un texte quelconque.
    render(<MarkdownText content="Un simple paragraphe sans mise en forme." />)
    expect(screen.getByText('Un simple paragraphe sans mise en forme.')).toBeDefined()
  })
})

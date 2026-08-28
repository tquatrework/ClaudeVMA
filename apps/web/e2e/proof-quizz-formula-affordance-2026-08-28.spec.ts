import { test, expect, type Page } from '@playwright/test'
import { createTestTeacher } from './support/api'

/**
 * Preuve visuelle a la pile reelle (https://claudevma.visioprof.fr) de l'affordance de saisie de
 * formule mathematique ajoutee aux champs Enonce et Options d'une question de Quizz.
 *
 * Retour utilisateur du 2026-08-28 : le rendu KaTeX (affichage) avait bien ete reutilise du Memo,
 * mais pas l'affordance de saisie — l'eleve/le professeur ne voyait qu'un texte d'indice
 * ("vous pouvez taper $x^2$"), sans aucune aide a la frappe. Ce test prouve que le bouton
 * "+ Inserer une formule" (meme composant MathLive que MemoFormulaInput, meme patron
 * d'interaction que InsertLinkButton) est bien present a cote des champs Enonce/Option, qu'un clic
 * dessus insere reellement la syntaxe `$latex$` a la position du curseur, et que l'apercu KaTeX se
 * met a jour en direct — a la creation ET a l'edition (meme composant partage `QuizForm`).
 */

const PASSWORD = 'E2eTest!2026'

async function login(page: Page, loginIdentifier: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

/**
 * Ouvre la popover "+ Inserer une formule" pour un champ donne, saisit la formule (via le champ
 * MathLive s'il s'est enregistre comme element personnalise, ou via le repli textarea sinon —
 * meme logique de repli que `MemoFormulaInput`), puis clique "Inserer".
 */
async function insertFormulaViaButton(page: Page, fieldLabel: string, latex: string) {
  await page.getByRole('button', { name: `Insérer une formule dans « ${fieldLabel} »` }).click()

  const mathField = page.locator('math-field')
  const fallbackTextarea = page.getByPlaceholder('ex : x^2 + y^2 = z^2')

  await Promise.race([
    mathField.waitFor({ state: 'attached', timeout: 6000 }).catch(() => {}),
    fallbackTextarea.waitFor({ state: 'attached', timeout: 6000 }).catch(() => {}),
  ])

  if ((await mathField.count()) > 0) {
    await page.evaluate((value) => {
      const el = document.querySelector('math-field') as unknown as { value: string } | null
      if (el) {
        el.value = value
        ;(el as unknown as EventTarget).dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, latex)
  } else {
    await fallbackTextarea.fill(latex)
  }

  await page.getByRole('button', { name: 'Insérer', exact: true }).click()
}

test('professeur — bouton "Insérer une formule" (Énoncé + Option), insertion réelle et aperçu KaTeX en direct', async ({
  page,
}) => {
  const suffix = Date.now().toString()
  const teacher = await createTestTeacher(suffix, 'Formule', 'ProfTest')

  await login(page, teacher.loginIdentifier, PASSWORD)
  await page.goto('/content/quizz')
  await expect(page.getByRole('heading', { name: 'Quizz' })).toBeVisible()

  await page.getByRole('button', { name: 'Créer un nouveau Quizz' }).click()
  await page.getByLabel(/Titre/).fill(`Preuve formule quizz ${suffix}`)
  await page.getByLabel('Description').fill('Preuve e2e — bouton Insérer une formule (2026-08-28)')

  // Avant insertion : le bouton est bien visible à côté du champ Énoncé, seul un texte d'indice
  // (jamais un vrai aperçu) accompagne le champ vide.
  const insertFormulaInPromptButton = page.getByRole('button', {
    name: 'Insérer une formule dans « Énoncé »',
  })
  await expect(insertFormulaInPromptButton).toBeVisible()
  await expect(page.getByText(/Aperçu :/)).toHaveCount(0)
  await page.screenshot({
    path: 'test-results/proof-quiz-formula-01-bouton-visible-avant-insertion.png',
    fullPage: true,
  })

  // Insertion réelle dans l'énoncé.
  await insertFormulaViaButton(page, 'Énoncé', 'x^2+y^2=z^2')

  const promptTextarea = page.getByPlaceholder(/Vous pouvez insérer une formule mathématique/)
  await expect(promptTextarea).toHaveValue(/\$x\^2\+y\^2=z\^2\$/)

  // L'aperçu affiche désormais un rendu KaTeX réel (pas la syntaxe brute affichée telle quelle).
  await expect(page.getByText(/Aperçu :/)).toBeVisible()
  await expect(page.locator('.katex').first()).toBeVisible()
  await page.screenshot({
    path: 'test-results/proof-quiz-formula-02-enonce-inséré-apercu-katex.png',
    fullPage: true,
  })

  // Insertion dans une option — même bouton, même comportement, position relative identique.
  const insertFormulaInOption1Button = page.getByRole('button', {
    name: 'Insérer une formule dans « Option 1 »',
  })
  await expect(insertFormulaInOption1Button).toBeVisible()
  await insertFormulaViaButton(page, 'Option 1', '\\sqrt{2}')

  const optionInputs = page.locator(
    'input[placeholder="Texte de l\'option — formule possible, ex : $x^2$"]',
  )
  await expect(optionInputs.nth(0)).toHaveValue(/\$\\sqrt\{2\}\$/)
  await optionInputs.nth(1).fill('Non')
  await page.locator('input[type="radio"]').nth(0).check()

  await expect(page.locator('.katex').nth(1)).toBeVisible()
  await page.screenshot({
    path: 'test-results/proof-quiz-formula-03-option-inséré-apercu-katex.png',
    fullPage: true,
  })

  // Soumission réelle, pour vérifier que la formule survit à l'aller-retour serveur.
  await page.getByRole('button', { name: 'Créer le Quizz' }).click()
  await expect(page.getByText(/créé avec succès/)).toBeVisible({ timeout: 15_000 })

  // Édition — même composant partagé `QuizForm` : l'affordance doit être présente à l'identique.
  await page.getByRole('button', { name: 'Modifier le Quizz' }).click()
  await expect(page.getByRole('heading', { name: 'Modifier le Quizz', level: 2 })).toBeVisible({
    timeout: 15_000,
  })
  await expect(promptTextarea).toHaveValue(/\$x\^2\+y\^2=z\^2\$/)
  await expect(
    page.getByRole('button', { name: 'Insérer une formule dans « Énoncé »' }),
  ).toBeVisible()
  await expect(page.locator('.katex').first()).toBeVisible()
  await page.screenshot({
    path: 'test-results/proof-quiz-formula-04-edition-formule-preremplie.png',
    fullPage: true,
  })
})

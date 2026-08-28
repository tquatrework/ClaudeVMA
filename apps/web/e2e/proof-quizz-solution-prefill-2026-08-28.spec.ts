import { test, expect } from '@playwright/test'

/**
 * Preuve visuelle contre la pile réelle (`https://claudevma.visioprof.fr`) pour la suite directe
 * du chantier Quizz post-production (PR #167 `content-catalog-service`, mergée et déployée) :
 *
 * 1. `GET /quizzes/:id/solution` charge réellement le Quizz AVEC solution : l'écran d'édition
 *    pré-remplit désormais la bonne réponse déjà cochée (radio) — plus de bandeau demandant à
 *    l'auteur de la re-cocher.
 * 2. `GET /validations/quiz/:id/history` est désormais ouverte à l'auteur formateur : « Mes
 *    Quizz » affiche le vrai motif de refus d'un Quizz `rejected`, plus « indisponible ».
 *
 * Réutilise le compte de test déjà créé pour les chantiers Quizz précédents
 * (`e2e.quizprof.1787932490`), qui possède déjà des Quizz `pending_validation` et `rejected`.
 * Script jetable, pas une suite de non-régression.
 */

const PROF_PASSWORD = 'E2eTest!2026'

async function login(page: import('@playwright/test').Page, loginIdentifier: string, password: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login')
    await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    try {
      await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
      return
    } catch {
      if (attempt === 3) throw new Error(`Connexion impossible pour ${loginIdentifier} après 3 essais.`)
      await page.waitForTimeout(2000)
    }
  }
}

// Quizz créé pendant la vérification HTTP directe de ce chantier (`e2e.quizprof.1787932490`,
// via l'API réelle), avec une solution connue : choix multiples "2"/"4" corrects, "3" incorrect ;
// texte court, mots-clés "photosynthese, chlorophylle". Sert de fixture stable plutôt qu'un item
// de liste dont l'ordre pourrait varier.
const SONDE_QUIZ_ID = '699f941f-3719-45a6-9fed-959890a72fc4'

test('professeur — édition pré-remplit réellement la solution (plus de bandeau de ressaisie)', async ({
  page,
}) => {
  await login(page, 'e2e.quizprof.1787932490', PROF_PASSWORD)

  await page.goto(`/content/quizz/${SONDE_QUIZ_ID}/edit`)
  await expect(page.locator('h1', { hasText: 'Modifier le Quizz' })).toBeVisible({
    timeout: 15_000,
  })

  // Plus de bandeau d'avertissement demandant de re-cocher/ressaisir.
  await expect(page.getByText(/re-cocher la ou les bonnes réponses/)).toHaveCount(0)

  // Question 1 (choix multiples) : "2" et "4" corrects, "3" incorrect — solution connue à la
  // création de cette fixture via l'API réelle. On ne prend que les cases OPTIONS (celles
  // directement suivies d'un champ texte d'option), pas les cases "barème spécifique" du
  // formulaire qui portent le même `type="checkbox"`.
  const optionInputs = page.locator('input[placeholder^="Texte de l\'option"]')
  await expect(optionInputs.first()).toBeVisible({ timeout: 15_000 })
  const optionStates = await optionInputs.evaluateAll((textInputs) =>
    (textInputs as HTMLInputElement[]).map((textInput) => {
      const checkbox = textInput.previousElementSibling as HTMLInputElement | null
      return { text: textInput.value, checked: checkbox?.checked ?? null }
    }),
  )
  console.log('[édition] options + état coché (choix multiples) :', optionStates)
  expect(optionStates).toEqual([
    { text: '2', checked: true },
    { text: '3', checked: false },
    { text: '4', checked: true },
  ])

  // Question 2 (texte court) : mots-clés déjà pré-remplis, jamais ressaisis.
  const keywordsInput = page.getByPlaceholder(/paris, capitale/)
  await expect(keywordsInput).toHaveValue('photosynthese, chlorophylle')

  await page.screenshot({
    path: 'test-results/proof-solution-prefill-01-edition.png',
    fullPage: true,
  })
})

test('professeur — "Mes Quizz" affiche le vrai motif de refus (plus "indisponible")', async ({ page }) => {
  await login(page, 'e2e.quizprof.1787932490', PROF_PASSWORD)

  await page.goto('/content/quizz')
  await page.getByRole('tab', { name: 'Mes Quizz' }).click()

  const rejectedBanner = page.locator('li', { hasText: 'Motif du refus' }).first()
  await expect(rejectedBanner).toBeVisible({ timeout: 15_000 })
  await expect(rejectedBanner.getByText('indisponible pour le moment')).toHaveCount(0)
  await expect(rejectedBanner).toContainText('Motif du refus :')

  const text = await rejectedBanner.textContent()
  console.log('[mes quizz] motif de refus affiché :', text)

  await page.screenshot({
    path: 'test-results/proof-solution-prefill-02-motif-refus.png',
    fullPage: true,
  })
})

import { test, expect } from '@playwright/test'

/**
 * Preuve visuelle contre la pile réelle (https://claudevma.visioprof.fr) : le RP et l'AP
 * atteignent l'écran de validation Quizz en CLIQUANT depuis le rail gauche (jamais
 * `page.goto('/content/validation')` direct), et y voient réellement des Quizz en attente.
 *
 * Contexte : retour utilisateur du 2026-08-28 (« je ne vois toujours pas où les RP/AP valident
 * un quizz »). Investigation avant ce test (voir rapport de session) :
 * - Le lien de navigation existe déjà pour RP (« Contenus à valider », rail « Validation ») et
 *   AP (« File de validation », rail « Mes contenus »), tous deux vers /content/validation —
 *   ajoutés par la PR #157 le 2026-08-28, présents dans le bundle actuellement déployé (vérifié
 *   par grep sur le JS servi par https://claudevma.visioprof.fr).
 * - `ContentValidationQueuePage` charge exercices/évaluations/tutoriels ET quizz en attente ;
 *   un ancien commentaire de test (proof-quizz-2026-08-28.spec.ts) redoutait que les routes
 *   /evaluations et /tutorials ne soient pas proxifiées par api-gateway (ce qui aurait fait
 *   échouer tout le Promise.all et masqué l'onglet Quizz derrière un message d'erreur plein
 *   écran) — vérifié en HTTP direct le jour même : les trois routes répondent `200`, ce risque
 *   ne se matérialise plus.
 * Ce test prouve donc le parcours de bout en bout, par clic, avec au moins un Quizz réel visible.
 */

const PASSWORD = 'E2eTest!2026'

async function login(page: import('@playwright/test').Page, loginIdentifier: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

test('RP — clique sur "Contenus à valider" depuis le rail et voit des Quizz en attente', async ({ page }) => {
  await login(page, 'rptest.proof.1787904014', 'VisioTest2026!')

  // Navigation par clic, jamais par URL directe. Le libellé « Contenus à valider » apparaît
  // deux fois (rail gauche ET raccourci du tableau de bord RP) : on cible ici le rail, qui est
  // le point d'entrée permanent (pas un raccourci de dashboard qui peut disparaître).
  await page.locator('aside').getByRole('link', { name: 'Contenus à valider' }).click()
  await expect(page).toHaveURL(/\/content\/validation/)
  await expect(page.getByRole('heading', { name: 'Validation des contenus' })).toBeVisible()

  await page.screenshot({
    path: 'test-results/proof-quizz-validation-nav-01-rp-page.png',
    fullPage: true,
  })

  // Onglet Quizz, cliqué (pas affiché par défaut — l'onglet "Exercices" est actif au départ).
  const quizTabButton = page.getByRole('button', { name: /^Quizz \(\d+\)$/ })
  await expect(quizTabButton).toBeVisible()
  await quizTabButton.click()

  // Au moins un Quizz réellement en attente doit apparaître dans la liste.
  await expect(page.getByText('Aucun quizz en attente.')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Valider' }).first()).toBeVisible()

  await page.screenshot({
    path: 'test-results/proof-quizz-validation-nav-02-rp-onglet-quizz.png',
    fullPage: true,
  })
})

test('AP lié au professeur — clique sur "File de validation" et voit le Quizz du professeur qu\'il anime', async ({ page }) => {
  await login(page, 'e2e.relatedap.1787957050', PASSWORD)

  await page.getByRole('link', { name: 'File de validation' }).click()
  await expect(page).toHaveURL(/\/content\/validation/)
  await expect(page.getByRole('heading', { name: 'Validation des contenus' })).toBeVisible()

  const quizTabButton = page.getByRole('button', { name: /^Quizz \(\d+\)$/ })
  await expect(quizTabButton).toBeVisible()
  await quizTabButton.click()

  await expect(page.getByText('Aucun quizz en attente.')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Valider' }).first()).toBeVisible()

  await page.screenshot({
    path: 'test-results/proof-quizz-validation-nav-03-ap-lie-onglet-quizz.png',
    fullPage: true,
  })
})

test('AP non lié — clique sur "File de validation" et voit un état vide propre, sans erreur', async ({ page }) => {
  await login(page, 'e2e.unrelatedap.1787957050', PASSWORD)

  await page.getByRole('link', { name: 'File de validation' }).click()
  await expect(page).toHaveURL(/\/content\/validation/)
  await expect(page.getByRole('heading', { name: 'Validation des contenus' })).toBeVisible()

  // Aucun message d'erreur — la page doit charger normalement (avec ou sans onglets, selon
  // qu'il reste d'autres contenus en attente pour ce compte).
  await expect(page.getByText('Impossible de charger les contenus en attente.')).not.toBeVisible()

  const quizTabButton = page.getByRole('button', { name: /^Quizz \(\d+\)$/ })
  if (await quizTabButton.isVisible()) {
    await quizTabButton.click()
    await expect(page.getByText('Aucun quizz en attente.')).toBeVisible()
  }

  await page.screenshot({
    path: 'test-results/proof-quizz-validation-nav-04-ap-non-lie-etat-vide.png',
    fullPage: true,
  })
})

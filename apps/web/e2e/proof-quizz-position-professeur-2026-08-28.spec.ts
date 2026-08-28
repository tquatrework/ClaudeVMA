import { test, expect } from '@playwright/test'

const PASSWORD = 'VisioTest2026!'

// Preuve jouée contre un serveur de dev local dont VITE_API_BASE_URL pointe
// vers l'api-gateway RÉEL (https://claudevma.visioprof.fr/api/v1) : le
// correctif n'est pas encore déployé sur la pile réelle (branche non
// mergée), donc https://claudevma.visioprof.fr servirait encore l'ancien
// bundle. Le backend interrogé reste néanmoins le vrai backend de
// production — seul le bundle front change.
test.use({ baseURL: 'http://localhost:5173' })

/**
 * Preuve visuelle à la pile réelle pour le correctif du 2026-08-28 :
 * « Quizz » doit apparaître en première position du groupe « Contenus »
 * du rail gauche pour le rôle professeur, comme pour le rôle élève.
 *
 * Réutilise le compte de test créé pour proof-menus-lateraux-2026-08-27.spec.ts
 * (`menutest.prof.1787857885`). Script jetable, pas une suite de non-régression.
 */
test('rail gauche professeur — Quizz en tête du groupe Contenus', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill('menutest.prof.1787857885')
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })

  const rail = page.getByRole('complementary')
  await expect(rail).toBeVisible()

  const labels = (await rail.getByRole('link').allTextContents()).map((l) => l.trim())
  console.log('[professeur] rail gauche :', labels)

  const quizzIndex = labels.findIndex((label) => label.includes('Quizz'))
  const exercicesIndex = labels.findIndex((label) => label.includes('Exercices'))
  const evaluationsIndex = labels.findIndex((label) => label.includes('Évaluations'))
  const tutosIndex = labels.findIndex((label) => label.includes('Tutos-vidéos'))

  expect(quizzIndex).toBeGreaterThanOrEqual(0)
  expect(quizzIndex).toBeLessThan(exercicesIndex)
  expect(quizzIndex).toBeLessThan(evaluationsIndex)
  expect(quizzIndex).toBeLessThan(tutosIndex)

  await page.screenshot({
    path: 'test-results/proof-quizz-position-professeur.png',
    fullPage: true,
  })
})

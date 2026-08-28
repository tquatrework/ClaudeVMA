import { test, expect } from '@playwright/test'

const PASSWORD = 'VisioTest2026!'

/**
 * Preuve visuelle à la pile réelle, contre `feat/menus-lateraux-par-role` (PR #142),
 * pour le besoin du 2026-08-27 (`.claude/CURRENT-GOAL.md`) : révision du rail gauche par
 * rôle (élève, professeur, parent, AP) + branchement du carnet personnel généralisé (PR #140).
 *
 * Script jetable de capture d'écran, pas une suite de non-régression : demandé par
 * l'utilisateur comme preuve avant merge, pas destiné à rester dans la suite permanente.
 */
const accounts = [
  { role: 'eleve', login: 'menutest.eleve.1787857885' },
  { role: 'professeur', login: 'menutest.prof.1787857885' },
  { role: 'parent', login: 'menutest.parent.1787857885' },
  { role: 'animateur-pedagogique', login: 'animateurpeda.lycee' },
]

for (const { role, login } of accounts) {
  test(`rail gauche — ${role}`, async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('jean.dupont').fill(login)
    await page.getByPlaceholder('••••••••').fill(PASSWORD)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })

    const rail = page.getByRole('complementary')
    await expect(rail).toBeVisible()

    const labels = (await rail.getByRole('link').allTextContents()).map((l) => l.trim())
    console.log(`[${role}] rail gauche :`, labels)

    await page.screenshot({
      path: `test-results/proof-menu-${role}.png`,
      fullPage: true,
    })
  })
}

test('carnet personnel — notes rapides, sans édition, recherche par mot', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill('menutest.eleve.1787857885')
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })

  await page.goto('/notebook/mine')
  await page.screenshot({ path: 'test-results/proof-carnet-personnel.png', fullPage: true })
})

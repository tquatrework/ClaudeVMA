import { test, expect } from '@playwright/test'

const PASSWORD = 'VisioTest2026!'
const STUDENT_ID = 'f234b258-62ff-4aa9-a70a-a87e4e9cf30b'

/**
 * Preuve visuelle a la pile reelle, apres merge et redeploiement des PR #147 (backend)
 * et #148 (front) — acces admin/parent en lecture seule au carnet personnel, parametrable TI.
 * Script jetable de capture d'ecran, pas une suite de non-regression.
 */

async function login(page: import('@playwright/test').Page, login: string) {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(login)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

test('TI — reglages acces carnet personnel visibles dans Parametres systeme', async ({ page }) => {
  await login(page, 'technicien.informatique')
  await page.goto('/admin/observability/site-metadata')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/proof-carnet-admin-ti-settings.png', fullPage: true })
})

test('RP — section carnet personnel en lecture seule sur la fiche eleve', async ({ page }) => {
  await login(page, 'rptest.proof.1787904014')
  await page.goto(`/profiles/${STUDENT_ID}`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/proof-carnet-admin-rp-profile.png', fullPage: true })
})

test('Parent — section carnet personnel en lecture seule sur la fiche de son enfant', async ({ page }) => {
  await login(page, 'menutest.parent.1787857885')
  await page.goto(`/profiles/${STUDENT_ID}`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/proof-carnet-admin-parent-profile.png', fullPage: true })
})

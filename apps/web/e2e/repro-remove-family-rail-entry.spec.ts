import { test, expect } from '@playwright/test'
import { createTestStudentWithParent } from './support/api'

const PASSWORD = 'E2eTest!2026'

/**
 * Preuve à la pile réelle du besoin « retirer FAMILLE/Mes parents financeurs du rail
 * gauche élève » (`.claude/CURRENT-GOAL.md`, besoin du 2026-08-17).
 *
 * Vérifie deux choses avec un compte élève créé via les routes réelles d'inscription,
 * lié à un parent financeur réel dans le même appel :
 *  1. le rail gauche élève ne comporte plus d'entrée « Famille » / « Mes parents
 *     financeurs » (ni le groupe, ni le lien vers /parent-link-requests/inbox) ;
 *  2. l'information reste consultable : l'onglet « Parents financeurs » du profil
 *     affiche bien le parent financeur réellement rattaché, par son prénom + nom.
 */
test('le rail gauche élève ne montre plus "Mes parents financeurs", l\'info reste dans le profil', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const uniqueSuffix = Date.now().toString()

  const { student, parent } = await createTestStudentWithParent(
    uniqueSuffix,
    'Lea',
    'Railtest',
    'Marc',
    'Railtest',
  )
  expect(parent, 'un parent financeur a bien été créé et lié').not.toBeNull()

  // ── Connexion élève ──
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(student.loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  // ── Preuve 1 : le rail gauche ne comporte plus l'entrée retirée ──
  await expect(
    page.getByRole('link', { name: 'Mes parents financeurs' }),
    'entrée de rail "Mes parents financeurs" absente pour l\'élève',
  ).toHaveCount(0)
  await expect(
    page.getByText('Famille', { exact: true }),
    'libellé de groupe "Famille" absent du rail élève',
  ).toHaveCount(0)
  await page.screenshot({ path: 'test-results/proof-rail-eleve-sans-famille.png', fullPage: true })

  // ── Preuve 2 : l'information reste accessible depuis le profil de l'élève ──
  await page.goto(`/profiles/${student.id}`)
  await page.getByRole('tab', { name: 'Parents financeurs' }).click()
  await expect(
    page.getByText('Marc Railtest', { exact: false }).first(),
    'le parent financeur rattaché est visible par prénom + nom dans le profil',
  ).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'test-results/proof-profil-onglet-parents-financeurs.png', fullPage: true })

  console.log(
    `Preuve : élève ${student.loginIdentifier} — rail sans "Mes parents financeurs", ` +
      `onglet profil affichant le parent financeur rattaché.`,
  )
})

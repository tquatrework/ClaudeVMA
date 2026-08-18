import { test, expect } from '@playwright/test'
import { createTestStudent, createTestTeacher } from './support/api'

/**
 * Preuve à l'écran de l'arbitrage du 2026-08-17 (`docs/architecture.md` >
 * « Defauts de visibilite champ par champ, et perimetre administrable de
 * l'ecran /visibilite »), après reconstruction/redéploiement réel de
 * `profile-service` et `frontend` par l'orchestrateur (branche de vérification
 * `verify/visibilite-defauts-role`).
 *
 * Vérifie sur l'écran réel (`/profiles/:userId/visibility`, route derrière le
 * lien « Confidentialité » de la fiche de profil) que :
 *  1. Le prénom et le nom ne sont plus des réglages proposés (retirés du
 *     catalogue, toujours visibles, jamais masquables) — pour un élève ET pour
 *     un formateur.
 *  2. Le catalogue est filtré par le rôle réel du titulaire : un élève ne voit
 *     que le bloc « Profil pédagogique — élève » (jamais les champs du bloc
 *     formateur : experience, diplomas, specialties, cvDocumentId) ; un
 *     formateur ne voit que le bloc « Profil pédagogique — formateur » (jamais
 *     les champs du bloc élève : schoolName, familyContext, difficulties).
 *
 * Comptes créés via les routes publiques réelles (`POST /accounts/students`,
 * `POST /accounts/teachers`), aucun mock, jouées contre
 * https://claudevma.visioprof.fr.
 */

const STUDENT_FIRST_NAME = 'Camille'
const STUDENT_LAST_NAME = 'Rousseau'
const TEACHER_FIRST_NAME = 'Julien'
const TEACHER_LAST_NAME = 'Mercier'

const PASSWORD = 'E2eTest!2026'

async function loginViaScreen(
  page: import('@playwright/test').Page,
  loginIdentifier: string,
): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('élève — écran de confidentialité sans réglage prénom/nom, sans bloc formateur', async ({
  page,
}) => {
  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const student = await createTestStudent(uniqueSuffix, STUDENT_FIRST_NAME, STUDENT_LAST_NAME)

  await loginViaScreen(page, student.loginIdentifier)
  await page.goto(`/profiles/${student.id}/visibility`)

  await expect(page.getByRole('heading', { name: 'Confidentialité' })).toBeVisible()

  // Le catalogue doit être arrivé : au moins un bloc administratif rendu.
  await expect(page.getByText('Informations administratives')).toBeVisible()

  // 1. Prénom / Nom ne sont plus des réglages proposés.
  await expect(page.getByText('Prénom', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Nom', { exact: true })).toHaveCount(0)

  // 2. Bloc pédagogique élève présent, bloc pédagogique formateur absent.
  await expect(page.getByText('Profil pédagogique — élève')).toBeVisible()
  await expect(page.getByText('Profil pédagogique — formateur')).toHaveCount(0)

  // Champs déclaratifs élève effectivement listés.
  await expect(page.getByText('Établissement', { exact: true })).toBeVisible()
  await expect(page.getByText('Difficultés rencontrées', { exact: true })).toBeVisible()

  // Aucun champ du bloc formateur ne doit apparaître.
  await expect(page.getByText('Expérience pédagogique', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Diplômes et certifications', { exact: true })).toHaveCount(0)
  await expect(page.getByText("Spécialités d'accompagnement", { exact: true })).toHaveCount(0)
  await expect(page.getByText('CV (référence du document)', { exact: true })).toHaveCount(0)

  await page.screenshot({
    path: 'test-results/proof-field-visibility-eleve.png',
    fullPage: true,
  })
})

test('formateur — écran de confidentialité sans réglage prénom/nom, sans bloc élève', async ({
  page,
}) => {
  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const teacher = await createTestTeacher(uniqueSuffix, TEACHER_FIRST_NAME, TEACHER_LAST_NAME)

  await loginViaScreen(page, teacher.loginIdentifier)
  await page.goto(`/profiles/${teacher.id}/visibility`)

  await expect(page.getByRole('heading', { name: 'Confidentialité' })).toBeVisible()
  await expect(page.getByText('Informations administratives')).toBeVisible()

  // 1. Prénom / Nom ne sont plus des réglages proposés.
  await expect(page.getByText('Prénom', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Nom', { exact: true })).toHaveCount(0)

  // 2. Bloc pédagogique formateur présent, bloc pédagogique élève absent.
  await expect(page.getByText('Profil pédagogique — formateur')).toBeVisible()
  await expect(page.getByText('Profil pédagogique — élève')).toHaveCount(0)

  // Champs déclaratifs formateur effectivement listés.
  await expect(page.getByText('Expérience pédagogique', { exact: true })).toBeVisible()
  await expect(page.getByText('Diplômes et certifications', { exact: true })).toBeVisible()

  // Aucun champ du bloc élève ne doit apparaître.
  await expect(page.getByText('Établissement', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Contexte familial', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Difficultés rencontrées', { exact: true })).toHaveCount(0)

  await page.screenshot({
    path: 'test-results/proof-field-visibility-formateur.png',
    fullPage: true,
  })
})

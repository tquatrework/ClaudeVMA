import { test, expect } from '@playwright/test'
import { createTestStudent } from './support/api'

/**
 * Preuve à l'écran du point 1 du chantier « calendrier de disponibilités »
 * (`.claude/CURRENT-GOAL.md`), jouée contre la pile réelle — aucune requête n'est simulée.
 *
 * Onglet « Mes disponibilités » de `/calendar` : grille hebdomadaire lundi→dimanche,
 * 07:00–22:00. Interaction retenue (arbitrage) : clic sur une cellule vide pour créer un
 * créneau via un formulaire modal, clic sur un bloc existant pour l'éditer/supprimer.
 *
 * L'élève est un compte créé à chaque exécution via la route d'inscription réelle
 * (`POST /accounts/students`, `apps/web/e2e/support/api.ts`) — pas de fixture injectée en
 * base. Le CRUD `POST/PATCH/DELETE /calendars/:ownerId/availability-slots` a déjà été vérifié
 * en HTTP contre la pile réelle par ailleurs ; ce test couvre le geste écran manquant.
 */

const STUDENT_FIRST_NAME = 'Lucas'
const STUDENT_LAST_NAME = 'Availproof'

test('onglet Mes disponibilités : créer, redimensionner et supprimer un créneau', async ({
  page,
}) => {
  // ── Préparation : un compte élève réel, via la route d'inscription réelle ──
  const uniqueSuffix = Date.now().toString()
  const student = await createTestStudent(uniqueSuffix, STUDENT_FIRST_NAME, STUDENT_LAST_NAME)

  // ── 1. Connexion, navigation vers /calendar, onglet « Mes disponibilités » ──
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(student.loginIdentifier)
  await page.getByPlaceholder('••••••••').fill('E2eTest!2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto('/calendar')
  await page.getByRole('tab', { name: 'Mes disponibilités' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Mes disponibilités' })).toBeVisible()

  // ── 2. Créer un créneau récurrent hebdomadaire avec une date de fin ──
  await page.getByRole('button', { name: 'Ajouter un créneau lundi à 10:00' }).click()

  const createDialog = page.getByRole('dialog', { name: 'Nouveau créneau' })
  await expect(createDialog).toBeVisible()

  // Début/fin prérempli par le clic sur la cellule (10:00 → 11:00, cf. buildDefaultEndTime).
  await createDialog.getByLabel('Récurrence').selectOption('WEEKLY')
  await createDialog
    .getByLabel('Date de fin de récurrence (optionnel)')
    .fill('2026-12-31')
  await createDialog.getByRole('button', { name: 'Créer' }).click()

  await expect(createDialog).toBeHidden()

  const initialSlotButton = page.getByRole('button', {
    name: 'Modifier le créneau lundi 10:00 – 11:00 — Disponible',
  })
  await expect(initialSlotButton).toBeVisible()
  await expect(initialSlotButton.getByText('10:00 – 11:00')).toBeVisible()

  // ── 3. Redimensionner le créneau (modifier l'heure de fin) ──
  await initialSlotButton.click()

  const editDialog = page.getByRole('dialog', { name: 'Modifier le créneau' })
  await expect(editDialog).toBeVisible()
  await expect(editDialog.getByLabel('Début')).toHaveValue('10:00')
  await expect(editDialog.getByLabel('Fin')).toHaveValue('11:00')

  await editDialog.getByLabel('Fin').fill('12:00')
  await editDialog.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(editDialog).toBeHidden()

  const resizedSlotButton = page.getByRole('button', {
    name: 'Modifier le créneau lundi 10:00 – 12:00 — Disponible',
  })
  await expect(resizedSlotButton).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Modifier le créneau lundi 10:00 – 11:00 — Disponible' }),
  ).toBeHidden()

  // ── 5. Capture d'écran de la grille avec le créneau visible, avant suppression ──
  await page.screenshot({
    path: 'test-results/proof-calendar-disponibilites.png',
    fullPage: true,
  })

  // ── 4. Supprimer le créneau, vérifier sa disparition de la grille ──
  await resizedSlotButton.click()

  const editDialogForDeletion = page.getByRole('dialog', { name: 'Modifier le créneau' })
  await expect(editDialogForDeletion).toBeVisible()
  await editDialogForDeletion.getByRole('button', { name: 'Supprimer' }).click()

  await expect(editDialogForDeletion).toBeHidden()
  await expect(resizedSlotButton).toBeHidden()
  await expect(page.getByText('Aucun créneau de disponibilité renseigné')).toBeVisible()
})

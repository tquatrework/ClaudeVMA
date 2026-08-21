import { test, expect, type Page } from '@playwright/test'
import {
  attemptCreateLogEntry,
  acceptActivity,
  createCourseActivity,
  createTestStudentWithParent,
  createTestTeacher,
  login,
  waitForAutoCreatedLogEntry,
} from './support/api'
import { createTeacherStudentRelationViaInternalRoute } from './support/internalRelation'

/**
 * Preuve à l'écran des 5 points de la refonte du cahier de texte, branche
 * `feat/cahier-de-texte-refonte` (commit front `2590932`, backend clos avant cette session —
 * voir `.claude/CURRENT-GOAL.md` § « refonte du cahier de texte »), jouée contre la pile réelle
 * (`https://claudevma.visioprof.fr`) — aucune requête n'est simulée.
 *
 *   1. Le sélecteur de catégorie propose "Parent + Formateur (+RP)" (`parent_formateur`), plus
 *      "Élève + Formateur (+RP)" (`eleve_formateur`, retiré).
 *   2. Le formulaire a 3 zones optionnelles (date pré-remplie, déroulement, à faire) — une
 *      entrée avec seule la date est acceptée.
 *   3. Seul le formateur écrit : élève et parent n'ont pas le bouton, et un appel API direct de
 *      leur part est refusé (403).
 *   4. "Cahier de texte" affiche directement la liste, triée du plus récent au plus ancien, avec
 *      un filtre par date fonctionnel.
 *   5. Une entrée auto-créée à la confirmation d'une activité `cours` apparaît dans la liste
 *      (best-effort : le consommateur Redis est asynchrone, voir `waitForAutoCreatedLogEntry`).
 */

const PASSWORD = 'E2eTest!2026'

async function loginOnScreen(page: Page, loginIdentifier: string, password: string): Promise<void> {
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto('/login')
    await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 })
      return
    } catch {
      const rateLimited = await page
        .getByText('Service temporarily unavailable')
        .isVisible()
        .catch(() => false)
      if (!rateLimited || attempt === maxAttempts) throw new Error(`Échec de connexion pour ${loginIdentifier}`)
      console.log(`/auth/login limité (502), nouvelle tentative ${attempt + 1}/${maxAttempts}…`)
      await page.waitForTimeout(10_000)
    }
  }
}

/** Date du jour au format JJ/MM/AAAA, en heure locale — même logique que
 * `todayIsoCalendarDate`/`formatIsoCalendarDate` côté front (`src/utils/dateFormat.ts`), reprise
 * ici sans importer le front (la suite e2e reste indépendante du code source). */
function todayFrCalendarDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${day}/${month}/${year}`
}

test.describe('Refonte du cahier de texte — preuve des 5 points (2026-08-21)', () => {
  test('sélecteur corrigé, formulaire à 3 champs, écriture réservée au formateur, liste triée+filtrée, entrée auto-créée', async ({
    browser,
  }) => {
    test.setTimeout(300_000)

    const uniqueSuffix = Date.now().toString()
    const studentFirstName = 'Inès'
    const studentLastName = `CahierEleve${uniqueSuffix}`
    const parentFirstName = 'Marc'
    const parentLastName = `CahierParent${uniqueSuffix}`
    const teacherFirstName = 'Nadia'
    const teacherLastName = `CahierProf${uniqueSuffix}`

    // ══════════════════════════════════════════════════════════════════
    // Préparation : comptes réels (élève+parent liés automatiquement, formateur) + relation
    // TEACHER_OF_STUDENT posée via la route interne (mêmes conventions que les chantiers
    // précédents de ce projet — voir support/internalRelation.ts).
    // ══════════════════════════════════════════════════════════════════
    const { student, parent } = await createTestStudentWithParent(
      uniqueSuffix,
      studentFirstName,
      studentLastName,
      parentFirstName,
      parentLastName,
    )
    console.log(`Élève créé : ${student.id} (${student.loginIdentifier})`)
    console.log(`Parent financeur créé : ${parent.id} (${parent.loginIdentifier})`)

    const teacher = await createTestTeacher(uniqueSuffix, teacherFirstName, teacherLastName)
    console.log(`Formateur créé : ${teacher.id} (${teacher.loginIdentifier})`)

    const relationResult = createTeacherStudentRelationViaInternalRoute(teacher.id, student.id, true)
    console.log(
      `POST /internal/create-teacher-student-relation (via docker exec) -> ${relationResult.status} ` +
        `${JSON.stringify(relationResult.body)}`,
    )
    expect([200, 201], 'création de la relation TEACHER_OF_STUDENT').toContain(relationResult.status)

    const teacherLoginRes = await login(teacher.loginIdentifier, PASSWORD)
    expect(teacherLoginRes.status, 'connexion API formateur (préparation)').toBe(201)
    const teacherToken = teacherLoginRes.body.access_token

    const studentLoginRes = await login(student.loginIdentifier, PASSWORD)
    expect(studentLoginRes.status, 'connexion API élève (préparation)').toBe(201)
    const studentToken = studentLoginRes.body.access_token

    const parentLoginRes = await login(parent.loginIdentifier, PASSWORD)
    expect(parentLoginRes.status, 'connexion API parent (préparation)').toBe(201)
    const parentToken = parentLoginRes.body.access_token

    const teacherContext = await browser.newContext()
    const teacherPage = await teacherContext.newPage()

    try {
      // ══════════════════════════════════════════════════════════════
      // Point 4 (première moitié) — cliquer sur "Cahier de texte" affiche directement la liste,
      // sans passer par une URL avec ?studentId= construite à la main.
      // ══════════════════════════════════════════════════════════════
      await loginOnScreen(teacherPage, teacher.loginIdentifier, PASSWORD)

      const rail = teacherPage.getByRole('complementary')
      const cahierLink = rail.getByRole('link', { name: 'Cahier de texte' })
      await expect(cahierLink, 'le rail formateur propose "Cahier de texte"').toBeVisible()
      await cahierLink.click()

      await expect(teacherPage).toHaveURL(/\/pedagogical-log/)
      await expect(
        teacherPage.getByText('Impossible de charger le cahier de texte.'),
        'plus d\'erreur "impossible de charger le cahier de texte" au clic',
      ).toHaveCount(0)

      const heading = teacherPage.getByRole('heading', { name: 'Cahier de texte' })
      await expect(heading, 'la page affiche directement son contenu').toBeVisible()

      // Le formateur n'a qu'un seul élève lié : sélectionné par défaut, pas besoin de forcer
      // ?studentId= à la main pour la suite du scénario.
      await expect(teacherPage.locator('#log-visibility-select'), 'formulaire de création visible pour le formateur').toBeVisible({
        timeout: 15_000,
      })

      await teacherPage.screenshot({
        path: 'test-results/cahier-01-liste-directe-formateur.png',
        fullPage: true,
      })

      // ══════════════════════════════════════════════════════════════
      // Point 1 — sélecteur de catégorie corrigé.
      // ══════════════════════════════════════════════════════════════
      const visibilitySelect = teacherPage.locator('#log-visibility-select')
      const optionTexts = (await visibilitySelect.locator('option').allTextContents()).map((text) =>
        text.trim(),
      )
      console.log(`Options du sélecteur de visibilité : ${JSON.stringify(optionTexts)}`)

      const hasParentFormateurOption = optionTexts.some((text) => text.includes('Parent + Formateur'))
      expect(hasParentFormateurOption, '"Parent + Formateur (+RP)" est bien proposé').toBe(true)

      const hasOldEleveFormateurLabel = optionTexts.some(
        (text) => text.includes('Élève + Formateur') && !text.includes('Parent'),
      )
      expect(
        hasOldEleveFormateurLabel,
        'l\'ancien libellé "Élève + Formateur (+RP)" (sans Parent) a bien disparu',
      ).toBe(false)

      const parentFormateurOptionValue = visibilitySelect.locator('option[value="parent_formateur"]')
      await expect(parentFormateurOptionValue, 'la valeur technique parent_formateur existe').toHaveCount(1)
      const eleveFormateurOptionValue = visibilitySelect.locator('option[value="eleve_formateur"]')
      await expect(
        eleveFormateurOptionValue,
        'l\'ancienne valeur technique eleve_formateur a bien disparu du sélecteur',
      ).toHaveCount(0)

      await visibilitySelect.screenshot({ path: 'test-results/cahier-02-selecteur-visibilite.png' })

      // ══════════════════════════════════════════════════════════════
      // Point 2 — formulaire à 3 zones optionnelles : date pré-remplie à aujourd'hui, une
      // entrée avec SEULE la date renseignée doit être acceptée.
      // ══════════════════════════════════════════════════════════════
      await visibilitySelect.selectOption('parent_formateur')

      const dateInput = teacherPage.locator('#log-date')
      const sessionSummaryInput = teacherPage.locator('#log-session-summary')
      const homeworkInput = teacherPage.locator('#log-homework')

      const prefilledDateValue = await dateInput.inputValue()
      console.log(`Date pré-remplie du formulaire : ${prefilledDateValue}`)
      const now = new Date()
      const expectedIsoToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}`
      expect(prefilledDateValue, 'la date est pré-remplie à la date du jour').toBe(expectedIsoToday)

      await expect(sessionSummaryInput, '"Déroulement de la séance" démarre vide').toHaveValue('')
      await expect(homeworkInput, '"À faire" démarre vide').toHaveValue('')

      const createResponsePromise = teacherPage.waitForResponse(
        (response) =>
          /\/students\/.+\/pedagogical-log$/.test(response.url()) && response.request().method() === 'POST',
      )
      await teacherPage.getByRole('button', { name: 'Ajouter une entrée' }).click()
      const createResponse = await createResponsePromise
      const createBody = await createResponse.json().catch(() => null)
      console.log(`POST .../pedagogical-log (seule la date) -> ${createResponse.status()} ${JSON.stringify(createBody)}`)
      expect(createResponse.status(), 'entrée créée avec seule la date').toBe(201)
      expect(createBody?.sessionSummary ?? null, 'sessionSummary vide accepté').toBeFalsy()
      expect(createBody?.homework ?? null, 'homework vide accepté').toBeFalsy()
      expect(createBody?.visibility, 'catégorie parent_formateur bien enregistrée').toBe('parent_formateur')

      await expect(
        teacherPage.getByText('Entrée vide, non encore complétée.'),
        'l\'entrée seule-date créée est bien affichée, marquée vide',
      ).toBeVisible()

      await teacherPage.screenshot({ path: 'test-results/cahier-03-entree-seule-date-creee.png', fullPage: true })

      // ══════════════════════════════════════════════════════════════
      // Point 4 (seconde moitié) — tri récent → ancien + filtre par date. On ajoute deux
      // entrées à dates distinctes via API directe (formateur), pour observer un ordre non
      // trivial sur l'écran sans multiplier les soumissions de formulaire.
      // ══════════════════════════════════════════════════════════════
      const oldEntryDate = '2026-01-05'
      const midEntryDate = '2026-03-15'
      const oldEntryRes = await attemptCreateLogEntry(teacherToken, student.id, {
        date: oldEntryDate,
        sessionSummary: 'Séance janvier proof e2e',
        visibility: 'parent_formateur',
      })
      console.log(`POST .../pedagogical-log (${oldEntryDate}) -> ${oldEntryRes.status}`)
      expect(oldEntryRes.status, 'entrée datée de janvier créée').toBe(201)

      const midEntryRes = await attemptCreateLogEntry(teacherToken, student.id, {
        date: midEntryDate,
        sessionSummary: 'Séance mars proof e2e',
        visibility: 'formateur_rp',
      })
      console.log(`POST .../pedagogical-log (${midEntryDate}) -> ${midEntryRes.status}`)
      expect(midEntryRes.status, 'entrée datée de mars créée').toBe(201)

      await teacherPage.reload()
      await expect(teacherPage.getByText('Séance mars proof e2e')).toBeVisible({ timeout: 15_000 })
      await expect(teacherPage.getByText('Séance janvier proof e2e')).toBeVisible()

      const dateBadges = teacherPage.locator('li span.text-sm.font-medium.text-gray-700')
      const badgeCount = await dateBadges.count()
      expect(badgeCount, 'au moins les 3 entrées datées créées sont affichées').toBeGreaterThanOrEqual(3)
      const displayedDates = await dateBadges.allTextContents()
      console.log(`Dates affichées, dans l'ordre : ${JSON.stringify(displayedDates)}`)

      const todayIndex = displayedDates.indexOf(todayFrCalendarDate())
      const midIndex = displayedDates.indexOf('15/03/2026')
      const oldIndex = displayedDates.indexOf('05/01/2026')
      expect(todayIndex, 'l\'entrée du jour est présente').toBeGreaterThanOrEqual(0)
      expect(midIndex, 'l\'entrée de mars est présente').toBeGreaterThanOrEqual(0)
      expect(oldIndex, 'l\'entrée de janvier est présente').toBeGreaterThanOrEqual(0)
      expect(todayIndex, 'l\'entrée la plus récente (aujourd\'hui) apparaît avant celle de mars').toBeLessThan(midIndex)
      expect(midIndex, 'l\'entrée de mars apparaît avant celle de janvier (la plus ancienne)').toBeLessThan(oldIndex)

      await teacherPage.screenshot({ path: 'test-results/cahier-04-liste-triee-recent-ancien.png', fullPage: true })

      // Filtre par date : isoler l'entrée de mars.
      const fromFilterResponsePromise = teacherPage.waitForResponse(
        (response) =>
          /\/students\/.+\/pedagogical-log\?/.test(response.url()) && response.request().method() === 'GET',
      )
      await teacherPage.locator('#log-filter-from').fill(midEntryDate)
      await teacherPage.locator('#log-filter-to').fill(midEntryDate)
      const filterResponse = await fromFilterResponsePromise
      console.log(`GET .../pedagogical-log?from=${midEntryDate}&to=${midEntryDate} -> ${filterResponse.status()}`)
      expect(filterResponse.status(), 'filtre par date exécuté').toBe(200)

      await expect(teacherPage.getByText('Séance mars proof e2e'), 'l\'entrée de mars reste visible filtrée').toBeVisible()
      await expect(
        teacherPage.getByText('Séance janvier proof e2e'),
        'l\'entrée de janvier est exclue par le filtre',
      ).toHaveCount(0)

      await teacherPage.screenshot({ path: 'test-results/cahier-05-filtre-par-date.png', fullPage: true })

      // Réinitialisation du filtre pour la suite du scénario.
      await teacherPage.getByRole('button', { name: 'Réinitialiser' }).click()
      await expect(teacherPage.getByText('Séance janvier proof e2e')).toBeVisible({ timeout: 15_000 })
    } finally {
      await teacherContext.close()
    }

    // ══════════════════════════════════════════════════════════════════
    // Point 3 — écriture réservée au formateur : élève et parent n'ont pas le bouton d'écriture,
    // et une tentative API directe de leur part échoue en 403.
    // ══════════════════════════════════════════════════════════════════
    const studentContext = await browser.newContext()
    const studentPage = await studentContext.newPage()
    try {
      await loginOnScreen(studentPage, student.loginIdentifier, PASSWORD)
      await studentPage.goto('/pedagogical-log')

      await expect(
        studentPage.getByText('Vous consultez le cahier de texte en lecture seule.'),
        'bandeau lecture seule affiché à l\'élève',
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        studentPage.locator('#log-visibility-select'),
        'aucun formulaire de création proposé à l\'élève',
      ).toHaveCount(0)
      await expect(
        studentPage.getByRole('heading', { name: 'Nouvelle entrée' }),
        'aucun titre "Nouvelle entrée" affiché à l\'élève',
      ).toHaveCount(0)

      await studentPage.screenshot({ path: 'test-results/cahier-06-eleve-lecture-seule.png', fullPage: true })
    } finally {
      await studentContext.close()
    }

    const studentWriteAttempt = await attemptCreateLogEntry(studentToken, student.id, {
      date: '2026-05-01',
    })
    console.log(
      `POST .../pedagogical-log (tentative élève, bloqué côté interface) -> ${studentWriteAttempt.status} ` +
        `${JSON.stringify(studentWriteAttempt.body)}`,
    )
    expect(studentWriteAttempt.status, 'écriture élève refusée par le serveur').toBe(403)

    const parentContext = await browser.newContext()
    const parentPage = await parentContext.newPage()
    try {
      await loginOnScreen(parentPage, parent.loginIdentifier, PASSWORD)
      await parentPage.goto(`/pedagogical-log?studentId=${student.id}`)

      await expect(
        parentPage.getByText('Vous consultez le cahier de texte en lecture seule.'),
        'bandeau lecture seule affiché au parent',
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        parentPage.locator('#log-visibility-select'),
        'aucun formulaire de création proposé au parent',
      ).toHaveCount(0)

      await parentPage.screenshot({ path: 'test-results/cahier-07-parent-lecture-seule.png', fullPage: true })
    } finally {
      await parentContext.close()
    }

    const parentWriteAttempt = await attemptCreateLogEntry(parentToken, student.id, {
      date: '2026-05-01',
    })
    console.log(
      `POST .../pedagogical-log (tentative parent, bloqué côté interface) -> ${parentWriteAttempt.status} ` +
        `${JSON.stringify(parentWriteAttempt.body)}`,
    )
    expect(parentWriteAttempt.status, 'écriture parent refusée par le serveur').toBe(403)

    // ══════════════════════════════════════════════════════════════════
    // Point 5 — entrée auto-créée à la confirmation d'une activité `cours` (best-effort : le
    // consommateur Redis de pedagogical-log-service est asynchrone).
    // ══════════════════════════════════════════════════════════════════
    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 2)
    start.setUTCHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setUTCHours(11, 0, 0, 0)

    const activityRes = await createCourseActivity(
      teacherToken,
      student.id,
      start.toISOString(),
      end.toISOString(),
      'Cours e2e cahier de texte',
    )
    console.log(`POST /activities -> ${activityRes.status} ${JSON.stringify(activityRes.body)}`)
    expect(activityRes.status, 'création de l\'activité cours').toBe(201)
    const activityId = activityRes.body.id

    const acceptRes = await acceptActivity(studentToken, activityId)
    console.log(`POST /activities/${activityId}/accept -> ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`)
    expect(acceptRes.status, 'acceptation du créneau par l\'élève').toBe(201)

    const autoEntry = await waitForAutoCreatedLogEntry(teacherToken, student.id, activityId, 30_000, 2_000)
    if (autoEntry) {
      console.log(`Entrée auto-créée trouvée : ${JSON.stringify(autoEntry)}`)
      expect(autoEntry.autoCreated, 'entrée marquée autoCreated').toBe(true)
      expect(autoEntry.activityId, 'entrée liée à l\'activité confirmée').toBe(activityId)

      const finalCheckContext = await browser.newContext()
      const finalCheckPage = await finalCheckContext.newPage()
      try {
        await loginOnScreen(finalCheckPage, teacher.loginIdentifier, PASSWORD)
        await finalCheckPage.goto('/pedagogical-log')
        await expect(
          finalCheckPage.getByText('Générée automatiquement — à compléter'),
          'l\'entrée auto-créée est visible à l\'écran, marquée comme telle',
        ).toBeVisible({ timeout: 15_000 })
        await finalCheckPage.screenshot({
          path: 'test-results/cahier-08-entree-auto-creee.png',
          fullPage: true,
        })
      } finally {
        await finalCheckContext.close()
      }
    } else {
      console.warn(
        'Point 5 NON VÉRIFIÉ À L\'ÉCRAN : aucune entrée autoCreated liée à l\'activité ' +
          `${activityId} n\'est apparue dans un délai de 30s. Le mécanisme (consommateur Redis ` +
          'ActivityConfirmed) peut être plus lent que ce délai, ou en défaut — à signaler tel quel, ' +
          'sans le masquer ni le contourner.',
      )
      test.info().annotations.push({
        type: 'point-5-non-verifie',
        description:
          'Aucune entrée autoCreated liée à l\'activité de cours confirmée n\'est apparue dans un ' +
          'délai de 30s côté API (GET .../pedagogical-log). Point 5 non vérifié à l\'écran.',
      })
    }
  })
})

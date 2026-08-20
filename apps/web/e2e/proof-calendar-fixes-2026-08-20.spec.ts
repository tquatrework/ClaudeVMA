import { test, expect, type Page } from '@playwright/test'
import { createTestStudent, createTestTeacher } from './support/api'
import { createTeacherStudentRelationViaInternalRoute } from './support/internalRelation'

/**
 * Preuve à l'écran des 4 corrections livrées sur `/calendar`, branche
 * `fix/calendrier-creation-et-affichage` (rapport
 * `.claude/reports/front-developper-calendrier-corrections-2026-08-20.md`), jouée contre la pile
 * réelle — aucune requête n'est simulée. Inspiré de `proof-calendar-unified-view.spec.ts` (même
 * dossier, mêmes conventions de login/setup).
 *
 *   A. `CalendarModeSelector` : "Consultation" retiré, deux boutons restants mutuellement exclusifs.
 *   B. Grille avec vraies dates de semaine calendaire + libellé de semaine + navigation.
 *   C. Sélection au quart d'heure par glisser sur la grille.
 *   D. Vraie modale de création (`EventCreateFormModal`) : type, titre réellement optionnel,
 *      destinataire choisi par nom (`EventRecipientPicker`) avec prévisualisation busy/free
 *      (`LinkedCalendarView`), soumission, événement affiché avec repli "Sans titre" (jamais un
 *      fragment d'UUID).
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

/** Effectue un vrai glisser souris (mousedown → mousemove par étapes → mouseup) entre les centres
 * de deux locators — reproduit le geste réel attendu par `useGridRangeSelection`
 * (`mousedown`/`mouseenter`/`mouseup`), plutôt qu'un `dragTo` Playwright qui ne déclenche pas
 * toujours `mouseenter` sur les cases intermédiaires. */
async function dragBetween(page: Page, fromLocator: ReturnType<Page['getByRole']>, toLocator: ReturnType<Page['getByRole']>): Promise<void> {
  const fromBox = await fromLocator.boundingBox()
  const toBox = await toLocator.boundingBox()
  if (!fromBox || !toBox) throw new Error('Impossible de localiser les cases à glisser')
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 8 })
  await page.mouse.up()
}

test.describe('Corrections calendrier 2026-08-20 (A/B/C/D)', () => {
  test('mode selector à 2 boutons, semaine navigable, sélection au quart d\'heure, vraie création', async ({
    browser,
  }) => {
    test.setTimeout(180_000)

    const uniqueSuffix = Date.now().toString()
    const studentFirstName = 'Lou'
    const studentLastName = `Correctiftest${uniqueSuffix}`
    const teacherFirstName = 'Robin'
    const teacherLastName = `Correctifprof${uniqueSuffix}`

    // ── Préparation : comptes réels + relation TEACHER_OF_STUDENT ──
    const student = await createTestStudent(uniqueSuffix, studentFirstName, studentLastName)
    const teacher = await createTestTeacher(uniqueSuffix, teacherFirstName, teacherLastName)
    console.log(`Élève créé : ${student.id} (${student.loginIdentifier})`)
    console.log(`Formateur créé : ${teacher.id} (${teacher.loginIdentifier})`)

    const relationResult = createTeacherStudentRelationViaInternalRoute(teacher.id, student.id, true)
    console.log(
      `POST /internal/create-teacher-student-relation (via docker exec) -> ${relationResult.status} ` +
        `${JSON.stringify(relationResult.body)}`,
    )
    expect([200, 201], 'création de la relation TEACHER_OF_STUDENT').toContain(relationResult.status)

    const studentContext = await browser.newContext()
    const studentPage = await studentContext.newPage()

    try {
      await loginOnScreen(studentPage, student.loginIdentifier, PASSWORD)
      await studentPage.goto('/calendar')

      // ══════════════════════════════════════════════════════════════
      // Point A — sélecteur de mode : "Consultation" retiré, 2 boutons exclusifs
      // ══════════════════════════════════════════════════════════════
      const modeTablist = studentPage.getByRole('tablist', { name: "Mode d'interaction avec le calendrier" })
      await expect(modeTablist, 'sélecteur de mode visible').toBeVisible()

      const allTabs = modeTablist.getByRole('tab')
      await expect(allTabs, 'exactement 2 boutons de mode restants').toHaveCount(2)

      const consultationTab = studentPage.getByRole('tab', { name: 'Consultation' })
      await expect(consultationTab, 'le bouton "Consultation" a bien été retiré').toHaveCount(0)

      const availabilityTab = studentPage.getByRole('tab', { name: 'Indiquer une disponibilité' })
      const eventTab = studentPage.getByRole('tab', { name: 'Créer un événement' })
      await expect(availabilityTab).toBeVisible()
      await expect(eventTab).toBeVisible()

      await modeTablist.screenshot({ path: 'test-results/calendar-fixes-01-mode-selector.png' })

      // État neutre au départ : aucun des deux boutons sélectionné.
      await expect(availabilityTab).toHaveAttribute('aria-selected', 'false')
      await expect(eventTab).toHaveAttribute('aria-selected', 'false')

      // Activer "Créer un événement".
      await eventTab.click()
      await expect(eventTab, 'activé au premier clic').toHaveAttribute('aria-selected', 'true')
      await expect(availabilityTab).toHaveAttribute('aria-selected', 'false')

      // Activer l'autre bouton : exclusivité mutuelle — le premier se désélectionne.
      await availabilityTab.click()
      await expect(
        availabilityTab,
        'activer l\'autre bouton désélectionne le premier (exclusivité mutuelle)',
      ).toHaveAttribute('aria-selected', 'true')
      await expect(eventTab, 'le bouton précédemment actif est désormais désélectionné').toHaveAttribute(
        'aria-selected',
        'false',
      )

      // Re-cliquer sur le bouton déjà actif le désélectionne (retour à la consultation implicite).
      await availabilityTab.click()
      await expect(
        availabilityTab,
        're-cliquer sur le bouton actif le désélectionne',
      ).toHaveAttribute('aria-selected', 'false')
      await expect(eventTab).toHaveAttribute('aria-selected', 'false')

      // ══════════════════════════════════════════════════════════════
      // Point B — dates réelles de semaine calendaire + navigation
      // ══════════════════════════════════════════════════════════════
      const weekLabel = studentPage.locator('p.text-sm.font-medium.text-gray-700').filter({
        hasText: /^Semaine du/,
      })
      await expect(weekLabel, 'libellé de semaine visible').toBeVisible()
      const initialWeekLabelText = (await weekLabel.textContent())?.trim() ?? ''
      console.log(`Libellé de semaine initial : "${initialWeekLabelText}"`)
      expect(initialWeekLabelText).toMatch(/^Semaine du \d+.* \d{4}$/)

      // Vraies dates JJ/MM affichées sous chaque nom de jour (7 colonnes lundi → dimanche).
      const dayDates = studentPage.locator('text=/^\\d{2}\\/\\d{2}$/')
      await expect(dayDates, 'au moins 7 dates réelles JJ/MM affichées sur la grille').toHaveCount(7)

      await studentPage.screenshot({
        path: 'test-results/calendar-fixes-02-real-dates.png',
        fullPage: true,
      })

      const nextWeekButton = studentPage.getByRole('button', { name: 'Semaine suivante' })
      await nextWeekButton.click()

      const nextWeekLabelText = (await weekLabel.textContent())?.trim() ?? ''
      console.log(`Libellé de semaine après "suivant" : "${nextWeekLabelText}"`)
      expect(
        nextWeekLabelText,
        'le libellé de semaine change après un clic sur "suivant"',
      ).not.toBe(initialWeekLabelText)

      await studentPage.screenshot({
        path: 'test-results/calendar-fixes-03-week-nav.png',
        fullPage: true,
      })

      // Retour à la semaine initiale pour la suite du scénario.
      const previousWeekButton = studentPage.getByRole('button', { name: 'Semaine précédente' })
      await previousWeekButton.click()
      const backToInitialWeekLabelText = (await weekLabel.textContent())?.trim() ?? ''
      expect(backToInitialWeekLabelText, 'retour exact à la semaine de départ').toBe(initialWeekLabelText)

      // ══════════════════════════════════════════════════════════════
      // Point C — sélection au quart d'heure par glisser, mode "Créer un événement"
      // ══════════════════════════════════════════════════════════════
      await eventTab.click()
      await expect(eventTab).toHaveAttribute('aria-selected', 'true')

      const cell1000 = studentPage.getByRole('button', { name: 'Ajouter un créneau mercredi à 10:00' })
      const cell1015 = studentPage.getByRole('button', { name: 'Ajouter un créneau mercredi à 10:15' })
      await expect(cell1000, 'case de quart d\'heure ciblable').toBeVisible()
      await expect(cell1015, 'case de quart d\'heure ciblable').toBeVisible()

      await dragBetween(studentPage, cell1000, cell1015)

      // ══════════════════════════════════════════════════════════════
      // Point D — vraie modale de création (type, titre optionnel, destinataire par nom,
      // prévisualisation busy/free)
      // ══════════════════════════════════════════════════════════════
      const eventDialog = studentPage.getByRole('dialog', { name: 'Créer un événement' })
      await expect(eventDialog, 'la modale de création s\'ouvre après le glisser').toBeVisible()

      // Preuve du quart d'heure près : le glisser 10:00 → 10:15 (deux quarts) produit la plage
      // 10:00–10:30 (borne de fin = début du quart suivant celui relâché), pré-remplie dans les
      // champs ajustables — pas un simple clic (qui aurait produit 10:00–11:00 par défaut).
      const startInput = eventDialog.locator('#event-create-start')
      const endInput = eventDialog.locator('#event-create-end')
      const startValue = await startInput.inputValue()
      const endValue = await endInput.inputValue()
      console.log(`Créneau par défaut proposé par la modale : ${startValue} → ${endValue}`)
      expect(startValue, 'début au quart d\'heure exact sélectionné').toContain('T10:00')
      expect(endValue, 'fin au quart d\'heure exact sélectionné (pas 1h par défaut)').toContain('T10:30')

      // Un élève n'a que "Rappel" comme type autorisé (ALLOWED_EVENT_TYPES_BY_ROLE.eleve).
      await expect(eventDialog.locator('#event-create-type')).toHaveValue('rappel')

      // Titre laissé VOLONTAIREMENT vide (réellement optionnel).
      await expect(eventDialog.locator('#event-create-title')).toHaveValue('')

      // Destinataire choisi PAR NOM — jamais un UUID saisi ni affiché.
      const recipientSearch = eventDialog.locator('#event-recipient-search')
      const teacherFullName = `${teacherFirstName} ${teacherLastName}`
      await recipientSearch.fill(teacherFirstName)

      const teacherCandidateButton = eventDialog.getByRole('button', { name: teacherFullName })
      await expect(
        teacherCandidateButton,
        'le formateur lié apparaît comme destinataire proposable, par son nom',
      ).toBeVisible({ timeout: 15_000 })

      const busyResponsePromise = studentPage.waitForResponse(
        (response) => /\/calendars\/.+\/busy(\?|$)/.test(response.url()) && response.request().method() === 'GET',
      )
      await teacherCandidateButton.click()
      const busyResponse = await busyResponsePromise
      console.log(`GET /calendars/:ownerId/busy (destinataire) -> ${busyResponse.status()}`)
      expect(busyResponse.status(), 'prévisualisation busy/free du destinataire choisi').toBe(200)

      // Le destinataire sélectionné apparaît comme "puce" nominative retirable — jamais un UUID.
      await expect(eventDialog.getByText(`Retirer ${teacherFullName}`, { exact: true })).toBeVisible()
      expect(
        await eventDialog.innerText(),
        'aucun UUID visible dans la modale (arbitrage du 2026-08-09)',
      ).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)

      // Les disponibilités busy/free du destinataire s'affichent bien (légende Disponible/Indisponible/Occupé).
      await expect(eventDialog.getByText(`Disponibilités de ${teacherFullName}`)).toBeVisible()
      await expect(eventDialog.getByText('Disponible', { exact: true })).toBeVisible()
      await expect(eventDialog.getByText('Indisponible', { exact: true })).toBeVisible()
      await expect(eventDialog.getByText('Occupé', { exact: true })).toBeVisible()

      await eventDialog.screenshot({
        path: 'test-results/calendar-fixes-04-event-modal-recipient-availability.png',
      })

      // ── Soumission : titre vide, réponse HTTP réelle citée ──
      const createEventResponsePromise = studentPage.waitForResponse(
        (response) =>
          /\/calendars\/.+\/events$/.test(response.url()) && response.request().method() === 'POST',
      )
      await eventDialog.getByRole('button', { name: 'Créer' }).click()
      const createEventResponse = await createEventResponsePromise
      const responseBody = await createEventResponse.json().catch(() => null)
      console.log(
        `POST /calendars/:ownerId/events -> ${createEventResponse.status()} ${JSON.stringify(responseBody)}`,
      )
      expect(createEventResponse.status(), 'création de l\'événement, titre omis').toBe(201)
      expect(
        responseBody?.title ?? null,
        'le serveur ne fabrique jamais de titre de repli — title est null/absent',
      ).toBeFalsy()

      await expect(eventDialog, 'la modale se ferme après succès').toBeHidden()

      // ── L'événement créé apparaît sur la grille avec le repli "Sans titre" — jamais un UUID ──
      const createdEventId: string | undefined = responseBody?.id
      const noTitleBlock = studentPage.getByText('Sans titre', { exact: true })
      await expect(
        noTitleBlock,
        'l\'événement sans titre affiche le repli "Sans titre" sur la grille',
      ).toBeVisible()

      if (createdEventId) {
        const pageText = await studentPage.locator('body').innerText()
        expect(
          pageText,
          'aucun fragment de l\'UUID de l\'événement n\'est affiché à l\'écran',
        ).not.toContain(createdEventId.slice(0, 8))
      }

      await studentPage.screenshot({
        path: 'test-results/calendar-fixes-05-event-created-no-title.png',
        fullPage: true,
      })
    } finally {
      await studentContext.close()
    }
  })
})

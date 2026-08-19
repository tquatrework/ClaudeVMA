import { test, expect, type Page } from '@playwright/test'
import {
  createTestStudent,
  createTestTeacher,
  login,
  listNotifications,
  waitForUnreadNotification,
} from './support/api'
import { createTeacherStudentRelationViaInternalRoute } from './support/internalRelation'

/**
 * Preuve à la pile réelle du point 3 du chantier « calendrier de disponibilités lié à la visio »
 * (proposer/accepter/refuser un créneau de cours) — cinq preuves demandées explicitement :
 *
 *   1. Un formateur propose un créneau à son élève, depuis `ProposeCourseSlotDialog`.
 *   2. `LinkedCalendarView` (busy/free de l'élève, point 2) est visible DANS ce composeur —
 *      première preuve à l'écran de ce composant, livré il y a plusieurs jours sans point de
 *      montage jusqu'au point 3.
 *   3. Le créneau apparaît dans le calendrier de l'élève (`/calendar`, onglet « Mes
 *      disponibilités »), en couleur pastel distincte des créneaux confirmés, avec des boutons
 *      Accepter/Refuser directement dessus.
 *   4. L'élève reçoit une notification dans la cloche : « Proposition de cours ajoutée par
 *      {nom du formateur} », qui mène à `/calendar` au clic.
 *   5. L'élève clique Accepter : le créneau passe en confirmé (couleur pleine, boutons
 *      disparus), et l'état affiché survit à un rechargement de page (preuve que ce n'est pas un
 *      état optimiste local qui pourrait mentir — la lecture après reload revient du serveur).
 *
 * Préparation de la relation TEACHER_OF_STUDENT : voir `support/internalRelation.ts` — route
 * interne de `profile-service`, jamais exposée par `api-gateway`, appelée via `docker exec` dans
 * le conteneur `visiomath_profile` pour ne jamais avoir à lire `INTERNAL_SECRET` sur ce poste.
 * Contournement d'test légitime déjà employé aux tours précédents de ce chantier (point 2),
 * documenté explicitement dans le rapport de session.
 */

const PASSWORD = 'E2eTest!2026'

/**
 * `api-gateway` limite le débit de `/auth/login` (zone `auth`, `limit_req` nginx — voir
 * `apps/web/e2e/README.md`). Ce test fait 3 connexions (préparation API + 2 connexions écran) ;
 * en enchaînement rapide avec d'autres exécutions de la suite, la dernière peut recevoir un
 * `502 "Service temporarily unavailable"` transitoire — pas un échec de l'application. Retry
 * borné plutôt qu'un test flaky.
 */
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
      const rateLimited = await page.getByText('Service temporarily unavailable').isVisible().catch(() => false)
      if (!rateLimited || attempt === maxAttempts) throw new Error(`Échec de connexion pour ${loginIdentifier}`)
      console.log(`/auth/login limité (502), nouvelle tentative ${attempt + 1}/${maxAttempts}…`)
      await page.waitForTimeout(10_000)
    }
  }
}

test.describe('Chantier calendrier — point 3 : proposer/accepter un créneau de cours', () => {
  test('formateur propose un créneau, élève reçoit la notification, accepte, créneau confirmé', async ({
    browser,
  }) => {
    test.setTimeout(180_000)

    const uniqueSuffix = Date.now().toString()
    const studentFirstName = 'Camille'
    const studentLastName = `Creneautest${uniqueSuffix}`
    const teacherFirstName = 'Morgane'
    const teacherLastName = `Creneauprof${uniqueSuffix}`

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

    const studentLoginRes = await login(student.loginIdentifier, PASSWORD)
    expect(studentLoginRes.status, 'connexion API élève (préparation)').toBe(201)
    const studentToken = studentLoginRes.body.access_token

    // Créneau proposé : demain, 14:00-15:00 UTC (le serveur du test tourne en UTC — voir
    // rapport de session — donc la valeur locale saisie dans le champ datetime-local
    // correspond exactement à l'heure UTC affichée par la grille, qui extrait ses heures en
    // UTC — `extractTimeOfDayFromIso`).
    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 1)
    start.setUTCHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setUTCHours(15, 0, 0, 0)
    const pad = (value: number) => value.toString().padStart(2, '0')
    const toDatetimeLocalValue = (date: Date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours(),
      )}:${pad(date.getMinutes())}`
    const startLocalValue = toDatetimeLocalValue(start)
    const endLocalValue = toDatetimeLocalValue(end)

    // ══════════════════════════════════════════════════════════════════
    // Étapes 1 & 2 — le formateur ouvre le composeur, LinkedCalendarView est visible, envoi
    // ══════════════════════════════════════════════════════════════════
    const teacherContext = await browser.newContext()
    const teacherPage = await teacherContext.newPage()
    try {
      await test.step('1-2. Formateur propose un créneau — LinkedCalendarView visible dans le composeur', async () => {
        await loginOnScreen(teacherPage, teacher.loginIdentifier, PASSWORD)

        await teacherPage.goto('/calendar')
        await teacherPage.getByRole('tab', { name: 'Propositions de cours' }).click()
        await teacherPage.getByRole('button', { name: 'Proposer un créneau' }).click()

        await expect(
          teacherPage.getByRole('dialog', { name: 'Proposer un créneau' }),
        ).toBeVisible()

        await teacherPage
          .locator('#propose-slot-recipient')
          .selectOption({ label: `${studentFirstName} ${studentLastName}` })

        // Preuve n°2 : LinkedCalendarView (busy/free de l'élève) monté dans le composeur.
        const linkedCalendarText = teacherPage.getByText(
          'Calendrier en lecture seule — seules les disponibilités',
        )
        await expect(linkedCalendarText, 'LinkedCalendarView visible dans le composeur').toBeVisible({
          timeout: 15_000,
        })
        await expect(teacherPage.getByText('Disponible', { exact: true })).toBeVisible()
        await expect(teacherPage.getByText('Occupé', { exact: true })).toBeVisible()

        await teacherPage.screenshot({
          path: 'test-results/course-slot-01-linked-calendar-view-in-composer.png',
          fullPage: true,
        })

        await teacherPage.locator('#propose-slot-start').fill(startLocalValue)
        await teacherPage.locator('#propose-slot-end').fill(endLocalValue)
        await teacherPage.locator('#propose-slot-title').fill('Cours de mathématiques — preuve e2e')

        const acceptResponsePromise = teacherPage.waitForResponse(
          (response) => response.url().includes('/activities') && response.request().method() === 'POST',
        )
        await teacherPage.getByRole('button', { name: 'Proposer ce créneau' }).click()
        const createResponse = await acceptResponsePromise
        console.log(`POST /activities -> ${createResponse.status()}`)
        expect(createResponse.status(), 'création de la proposition de créneau').toBe(201)

        await expect(
          teacherPage.getByText('Votre proposition de créneau a bien été envoyée.'),
        ).toBeVisible()
      })
    } finally {
      await teacherContext.close()
    }

    // ══════════════════════════════════════════════════════════════════
    // Étape 3 — attendre la notification serveur (consommateur Redis asynchrone)
    // ══════════════════════════════════════════════════════════════════
    await test.step("3. Notification server-side pour l'élève (avant capture écran)", async () => {
      const arrivedAfterSeconds = await waitForUnreadNotification(studentToken)
      console.log(
        `Notification course_slot_proposed arrivée après ${arrivedAfterSeconds}s (-1 = jamais arrivée).`,
      )
      expect
        .soft(arrivedAfterSeconds, "l'élève doit recevoir une notification course_slot_proposed")
        .toBeGreaterThan(-1)

      const studentNotifs = await listNotifications(studentToken)
      const proposalNotif = studentNotifs.body.data.find((n) => n.type === 'course_slot_proposed')
      console.log(`Notification trouvée : ${JSON.stringify(proposalNotif)}`)
      expect.soft(proposalNotif, 'notification course_slot_proposed présente côté élève').toBeTruthy()
      if (proposalNotif) {
        expect
          .soft(proposalNotif.metadata.proposerName, 'metadata.proposerName = nom du formateur')
          .toBe(`${teacherFirstName} ${teacherLastName}`)
      }
    })

    // ══════════════════════════════════════════════════════════════════
    // Étapes 4 & 5 — l'élève se connecte, voit la cloche + le créneau dans la grille, accepte
    // ══════════════════════════════════════════════════════════════════
    const studentContext = await browser.newContext()
    const studentPage = await studentContext.newPage()
    try {
      await test.step('4. Cloche de notification — libellé exact et navigation vers /calendar', async () => {
        await loginOnScreen(studentPage, student.loginIdentifier, PASSWORD)

        const bell = studentPage.locator('[aria-label^="Notifications"]')
        await expect(bell, 'cloche visible dans le header').toBeVisible()
        await bell.click()

        const expectedLabel = `Proposition de cours ajoutée par ${teacherFirstName} ${teacherLastName}`
        // Ciblé par rôle bouton (la ligne de la cloche est un <button>) : le dashboard affiche
        // aussi ce même texte dans un widget d'activité récente (<p>), ce qui rendrait une
        // recherche par texte seul ambiguë (strict mode Playwright).
        const notificationRow = studentPage.getByRole('button', { name: expectedLabel, exact: false })
        await expect(notificationRow, 'libellé exact de la notification dans la cloche').toBeVisible({
          timeout: 15_000,
        })

        await studentPage.screenshot({
          path: 'test-results/course-slot-02-notification-bell-label.png',
          fullPage: false,
        })

        await notificationRow.click()
        await expect(studentPage).toHaveURL(/\/calendar/)
      })

      await test.step('5. Créneau proposé visible en couleur pastel avec boutons Accepter/Refuser', async () => {
        await studentPage.getByRole('tab', { name: 'Mes disponibilités' }).click()

        const acceptButton = studentPage.getByRole('button', {
          name: new RegExp(`^Accepter la proposition de cours.*avec ${teacherFirstName} ${teacherLastName}$`),
        })
        await expect(acceptButton, 'bouton Accepter visible sur le créneau proposé').toBeVisible({
          timeout: 15_000,
        })
        const declineButton = studentPage.getByRole('button', {
          name: new RegExp(`^Refuser la proposition de cours.*avec ${teacherFirstName} ${teacherLastName}$`),
        })
        await expect(declineButton, 'bouton Refuser visible sur le créneau proposé').toBeVisible()

        // Couleur pastel (bg-indigo-50) distincte du bloc confirmé (bg-indigo-100) — ciblée sur
        // le conteneur `AvailabilityGrid` du bloc (seul élément avec `overflow-hidden` : la div
        // de contenu superposée par `ActivityGridBlockOverlay`, imbriquée dedans, n'a pas cette
        // classe et matcherait sinon via `.last()`, comme observé une première fois).
        const proposedBlock = studentPage
          .locator('div.overflow-hidden')
          .filter({ has: acceptButton })
          .last()
        await expect(proposedBlock).toHaveClass(/bg-indigo-50/)

        await studentPage.screenshot({
          path: 'test-results/course-slot-03-proposed-slot-pastel-with-buttons.png',
          fullPage: true,
        })

        // Preuve n°5 : accepter → confirmé, réponse serveur réelle (pas un état optimiste
        // supposé) — on attend la réponse HTTP réelle du serveur, puis on vérifie l'écran,
        // PUIS on recharge la page pour prouver que l'état vient bien d'une lecture serveur
        // et pas seulement d'un état local qui pourrait mentir après un rechargement.
        const acceptResponsePromise = studentPage.waitForResponse(
          (response) => /\/activities\/.+\/accept$/.test(response.url()) && response.request().method() === 'POST',
        )
        await acceptButton.click()
        const acceptResponse = await acceptResponsePromise
        console.log(`POST /activities/:id/accept -> ${acceptResponse.status()}`)
        expect(acceptResponse.status(), 'acceptation du créneau').toBe(201)
        const acceptBody = await acceptResponse.json()
        console.log(`Corps de la réponse accept : ${JSON.stringify(acceptBody)}`)
        expect.soft(acceptBody.status, 'statut renvoyé par le serveur après accept').toBe('confirmed')

        await expect(acceptButton).toHaveCount(0)
        await expect(declineButton).toHaveCount(0)

        // Le bloc confirmé n'affiche PAS le libellé `KIND_LABELS.CONFIRMED` (« Cours confirmé »)
        // — ce libellé n'est utilisé que par le rendu par défaut de `AvailabilityGrid`, jamais
        // atteint ici car `ActivityGridBlockOverlay` prend systématiquement le relais pour les
        // activités planifiées (PROPOSED comme CONFIRMED). CONFIRMED y affiche le type
        // (« Cours »), le nom du créateur et l'horaire, sans aucune action — d'où le ciblage par
        // classe de couleur pleine (`bg-indigo-100`) plutôt que par ce libellé.
        const confirmedBlock = studentPage.locator('div.overflow-hidden.bg-indigo-100')
        await expect(confirmedBlock, 'bloc confirmé (couleur pleine) visible').toBeVisible({
          timeout: 15_000,
        })
        await expect(confirmedBlock, 'le bloc confirmé porte le nom du formateur').toContainText(
          `${teacherFirstName} ${teacherLastName}`,
        )
        await expect(
          confirmedBlock.getByRole('button'),
          'aucun bouton Accepter/Refuser sur un bloc confirmé',
        ).toHaveCount(0)

        await studentPage.screenshot({
          path: 'test-results/course-slot-04-confirmed-slot-after-accept.png',
          fullPage: true,
        })

        // Rechargement : l'état confirmé doit survenir d'une VRAIE relecture serveur
        // (`GET /calendars/:ownerId`), pas d'un état local qui disparaîtrait au reload.
        await studentPage.reload()
        await studentPage.getByRole('tab', { name: 'Mes disponibilités' }).click()
        const confirmedBlockAfterReload = studentPage.locator('div.overflow-hidden.bg-indigo-100')
        await expect(
          confirmedBlockAfterReload,
          'le créneau confirmé survit à un rechargement (relecture serveur, pas un état optimiste)',
        ).toBeVisible({ timeout: 15_000 })

        await studentPage.screenshot({
          path: 'test-results/course-slot-05-confirmed-slot-after-reload.png',
          fullPage: true,
        })
      })
    } finally {
      await studentContext.close()
    }
  })
})

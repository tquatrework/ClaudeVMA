import { test, expect, type Page, type Locator } from '@playwright/test'
import { createTestStudent, createTestTeacher } from './support/api'
import { createTeacherStudentRelationViaInternalRoute } from './support/internalRelation'

/**
 * Preuve à l'écran du chantier « vue calendrier unifiée » (`.claude/CURRENT-GOAL.md`,
 * 2026-08-19), jouée contre la pile réelle — aucune requête n'est simulée.
 *
 * Contexte : `/calendar` fusionne désormais les trois anciens onglets (« Mes événements »,
 * « Mes disponibilités », « Propositions de cours ») en une seule grille (`CalendarUnifiedView`),
 * pilotée par un sélecteur de mode (`CalendarModeSelector` : Consultation / Créer une
 * disponibilité / Créer un événement). Créer un événement se fait par clic direct sur une case
 * de la grille (`QuickEventCreatePopover`), qui résout la date réelle depuis le jour de semaine
 * cliqué (la grille est un gabarit hebdomadaire récurrent, sans année ni semaine affichées) —
 * c'est ce mécanisme qui corrige le bug ISO 8601 rapporté par l'utilisateur (l'ancien
 * `EventCreateDialog` faisait saisir une date à la main).
 *
 * Cinq preuves demandées explicitement par la consigne de session :
 *   1. Grille unique visible immédiatement pour un élève, avec ses disponibilités.
 *   2. Créer un événement par clic (mode « Créer un événement »), sans erreur ISO 8601.
 *   3. Vue unifiée réelle : la proposition d'un formateur apparaît sur LA MÊME grille.
 *   4. Acceptation par clic : Accepter/Refuser apparaissent au clic, pas avant.
 *   5. Captures d'écran des étapes clés.
 *
 * Préparation de la relation TEACHER_OF_STUDENT : `support/internalRelation.ts` (route interne
 * de `profile-service`, jamais exposée par `api-gateway`, appelée via `docker exec` — même
 * contournement de test légitime que le point 3 du chantier précédent).
 */

const PASSWORD = 'E2eTest!2026'

/** Libellés français des jours de semaine, alignés sur `availabilityDays.ts` côté front
 * (0 = dimanche … 6 = samedi, `Date.prototype.getUTCDay()`). */
const DAY_LABELS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

/**
 * `api-gateway` limite le débit de `/auth/login` — retry borné plutôt qu'un test flaky, même
 * dispositif que les preuves précédentes de ce chantier (voir `apps/web/e2e/README.md`).
 */
/**
 * Vérifie qu'un élément n'est pas seulement présent dans le DOM et « visible » au sens
 * `toBeVisible()` de Playwright — qui ne détecte PAS un rognage par un ancêtre
 * `overflow: hidden` (bug réel constaté le 2026-08-19 : un bouton Accepter, présent dans le
 * DOM et cliquable par Playwright, restait rogné hors de la zone peinte de son bloc parent,
 * invisible pour un utilisateur réel). On vérifie ici que le point central du propre
 * rectangle de l'élément est effectivement peint PAR CET ÉLÉMENT (ou un de ses descendants),
 * via `document.elementFromPoint` — c'est ce test géométrique, et lui seul, qui aurait attrapé
 * ce bug avant ce correctif.
 */
async function expectActuallyPaintedAtOwnLocation(locator: Locator, description: string): Promise<void> {
  const isPaintedAtOwnLocation = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const elementAtPoint = document.elementFromPoint(centerX, centerY)
    return Boolean(
      elementAtPoint &&
        (elementAtPoint === element || element.contains(elementAtPoint) || elementAtPoint.contains(element)),
    )
  })
  expect(isPaintedAtOwnLocation, description).toBe(true)
}

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

test.describe('Chantier calendrier vue unifiée', () => {
  test('grille unique : disponibilité, événement créé par clic, proposition acceptée', async ({
    browser,
  }) => {
    test.setTimeout(180_000)

    const uniqueSuffix = Date.now().toString()
    const studentFirstName = 'Alix'
    const studentLastName = `Unifieetest${uniqueSuffix}`
    const teacherFirstName = 'Sacha'
    const teacherLastName = `Unifieeprof${uniqueSuffix}`

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

    // Jours de semaine "sûrs" (demain / après-demain), pour ne jamais dépendre du jour où le
    // test s'exécute. `getUTCDay()` — même convention que `dayOfWeek` côté front.
    const now = new Date()
    const tomorrowDayOfWeek = (now.getUTCDay() + 1) % 7
    const tomorrowDayLabelLower = DAY_LABELS_FR[tomorrowDayOfWeek].toLowerCase()
    const tomorrowDayLabel = DAY_LABELS_FR[tomorrowDayOfWeek]

    const proposalStart = new Date()
    proposalStart.setUTCDate(proposalStart.getUTCDate() + 2)
    proposalStart.setUTCHours(15, 0, 0, 0)
    const proposalEnd = new Date(proposalStart)
    proposalEnd.setUTCHours(16, 0, 0, 0)
    const pad = (value: number) => value.toString().padStart(2, '0')
    const toDatetimeLocalValue = (date: Date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours(),
      )}:${pad(date.getMinutes())}`

    // ══════════════════════════════════════════════════════════════════
    // Étape 1 — l'élève arrive sur /calendar : grille unique visible immédiatement
    // ══════════════════════════════════════════════════════════════════
    const studentContext = await browser.newContext()
    const studentPage = await studentContext.newPage()

    await test.step('1. Grille unique visible immédiatement pour un élève', async () => {
      await loginOnScreen(studentPage, student.loginIdentifier, PASSWORD)
      await studentPage.goto('/calendar')

      const modeTablist = studentPage.getByRole('tablist', { name: "Mode d'interaction avec le calendrier" })
      await expect(modeTablist, 'sélecteur de mode visible, pas d\'onglets séparés').toBeVisible()

      const consultationTab = studentPage.getByRole('tab', { name: 'Consultation' })
      await expect(consultationTab, 'mode Consultation actif par défaut').toHaveAttribute(
        'aria-selected',
        'true',
      )

      // Aucune disponibilité au départ pour un compte fraîchement créé — la grille s'affiche
      // quand même immédiatement (pas de chargement bloquant indéfini), et l'état vide est
      // explicite plutôt qu'un écran blanc.
      await expect(
        studentPage.getByText('Aucune donnée dans votre calendrier pour l\'instant'),
      ).toBeVisible()
    })

    // ── Création d'une disponibilité, pour avoir « quelque chose à voir » (point 1) ──
    await test.step('1bis. Créer une disponibilité par clic (mode « Créer une disponibilité »)', async () => {
      await studentPage.getByRole('tab', { name: 'Créer une disponibilité' }).click()
      await expect(studentPage.getByRole('tab', { name: 'Créer une disponibilité' })).toHaveAttribute(
        'aria-selected',
        'true',
      )

      await studentPage
        .getByRole('button', { name: `Ajouter un créneau ${tomorrowDayLabelLower} à 09:00` })
        .click()

      const createDialog = studentPage.getByRole('dialog', { name: 'Nouveau créneau' })
      await expect(createDialog).toBeVisible()
      await createDialog.getByRole('button', { name: 'Créer' }).click()
      await expect(createDialog).toBeHidden()

      const availabilityBlock = studentPage.getByRole('button', {
        name: `Modifier le créneau ${tomorrowDayLabelLower} 09:00 – 10:00 — Disponible`,
      })
      await expect(availabilityBlock, 'la disponibilité créée est visible sur la grille').toBeVisible()
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 2 — créer un événement par clic, sans erreur ISO 8601
    // ══════════════════════════════════════════════════════════════════
    let resolvedDateLabelText = ''
    await test.step('2. Créer un événement par clic — aucune erreur ISO 8601', async () => {
      await studentPage.getByRole('tab', { name: 'Créer un événement' }).click()
      await expect(studentPage.getByRole('tab', { name: 'Créer un événement' })).toHaveAttribute(
        'aria-selected',
        'true',
      )

      await studentPage
        .getByRole('button', { name: `Ajouter un créneau ${tomorrowDayLabelLower} à 12:00` })
        .click()

      const eventDialog = studentPage.getByRole('dialog', { name: 'Créer un événement' })
      await expect(eventDialog, 'popover de création rapide visible').toBeVisible()

      // La date réelle résolue (prochaine occurrence de ce jour de semaine) est affichée en
      // clair avant validation — preuve que ce n'est plus un champ datetime-local à saisir.
      const dateParagraph = eventDialog.locator('p.text-sm.text-gray-600').first()
      resolvedDateLabelText = (await dateParagraph.textContent()) ?? ''
      console.log(`Date résolue affichée dans le popover : "${resolvedDateLabelText}"`)
      expect(resolvedDateLabelText, 'le jour de semaine cliqué est repris dans le libellé').toContain(
        tomorrowDayLabel,
      )
      expect(resolvedDateLabelText, 'la plage horaire cliquée est reprise dans le libellé').toContain(
        '12:00 – 13:00',
      )

      // Un élève n'a que "Rappel" comme type autorisé (ALLOWED_EVENT_TYPES_BY_ROLE.eleve).
      await expect(eventDialog.locator('#quick-event-type')).toHaveValue('rappel')

      await eventDialog.locator('#quick-event-title').fill('Réviser le chapitre 3')

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
      // Preuve explicite demandée : pas de 400 "startTime must be a valid ISO 8601…".
      expect(createEventResponse.status(), 'création de l\'événement, sans erreur ISO 8601').toBe(201)

      await expect(eventDialog, 'le popover se ferme après succès').toBeHidden()

      // L'événement apparaît bien sur la grille après création (règle du 2026-08-10 : la
      // réponse serveur remonte au propriétaire de l'état, jamais une seconde requête).
      await expect(
        studentPage.getByText('Réviser le chapitre 3'),
        'événement créé visible sur la grille, sans recharger la page',
      ).toBeVisible()
    })

    await studentPage.screenshot({
      path: 'test-results/calendar-unified-01-availability-and-event.png',
      fullPage: true,
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 3 — le formateur propose un créneau, qui doit apparaître sur LA MÊME grille
    // ══════════════════════════════════════════════════════════════════
    const teacherContext = await browser.newContext()
    const teacherPage = await teacherContext.newPage()
    try {
      await test.step('3. Le formateur propose un créneau à l\'élève', async () => {
        await loginOnScreen(teacherPage, teacher.loginIdentifier, PASSWORD)
        await teacherPage.goto('/calendar')

        // Le panneau "Propositions de cours" est désormais replié en marge de la grille
        // (`<details>`), plus un onglet séparé — chantier vue unifiée.
        await teacherPage.getByText('Propositions de cours', { exact: true }).click()
        await teacherPage.getByRole('button', { name: 'Proposer un créneau' }).click()

        const proposeDialog = teacherPage.getByRole('dialog', { name: 'Proposer un créneau' })
        await expect(proposeDialog).toBeVisible()

        await proposeDialog
          .locator('#propose-slot-recipient')
          .selectOption({ label: `${studentFirstName} ${studentLastName}` })

        await proposeDialog.locator('#propose-slot-start').fill(toDatetimeLocalValue(proposalStart))
        await proposeDialog.locator('#propose-slot-end').fill(toDatetimeLocalValue(proposalEnd))
        await proposeDialog.locator('#propose-slot-title').fill('Cours de mathématiques — vue unifiée')

        const createActivityResponsePromise = teacherPage.waitForResponse(
          (response) => response.url().includes('/activities') && response.request().method() === 'POST',
        )
        await proposeDialog.getByRole('button', { name: 'Proposer ce créneau' }).click()
        const createActivityResponse = await createActivityResponsePromise
        console.log(`POST /activities -> ${createActivityResponse.status()}`)
        expect(createActivityResponse.status(), 'création de la proposition de créneau').toBe(201)

        await expect(
          teacherPage.getByText('Votre proposition de créneau a bien été envoyée.'),
        ).toBeVisible()
      })
    } finally {
      await teacherContext.close()
    }

    // ── La page élève ne se recharge jamais toute seule (règle du 2026-08-10) : on recharge
    // manuellement pour relire le calendrier, comme le ferait un élève qui revient sur l'écran.
    await studentPage.reload()

    // Filtré par le nom du formateur (toujours rendu, quel que soit l'état) plutôt que par
    // « Cliquer pour répondre » : ce texte disparaît une fois les boutons révélés, et un
    // filtre live re-évalué sur un texte qui vient de disparaître fait attendre indéfiniment
    // (`locator.boundingBox()`/`.click()` suivants bloquent jusqu'au timeout du test).
    // `z-10` (et non plus `overflow-hidden`, retiré par le correctif de visibilité des boutons
    // Accepter/Refuser/Rejoindre — voir étape 4bis) identifie les blocs à contenu superposé
    // (`renderBlockOverlay`) sur la grille : propositions/confirmations de cours, événements.
    const proposedBlock = studentPage
      .locator('div.absolute.z-10')
      .filter({ hasText: `${teacherFirstName} ${teacherLastName}` })

    await test.step('3bis. La proposition apparaît SUR LA MÊME grille — pas d\'onglet à changer', async () => {
      await expect(
        proposedBlock,
        'la proposition de cours est visible sur la grille unifiée de l\'élève',
      ).toBeVisible({ timeout: 15_000 })

      // Les trois sources sont visibles SIMULTANÉMENT sur la même grille, sans changer d'onglet.
      await expect(
        studentPage.getByRole('button', {
          name: `Modifier le créneau ${tomorrowDayLabelLower} 09:00 – 10:00 — Disponible`,
        }),
        'la disponibilité créée au point 1 est toujours visible',
      ).toBeVisible()
      await expect(
        studentPage.getByText('Réviser le chapitre 3'),
        'l\'événement créé au point 2 est toujours visible',
      ).toBeVisible()

      await expect(proposedBlock).toHaveClass(/bg-indigo-50/)
    })

    await studentPage.screenshot({
      path: 'test-results/calendar-unified-02-three-sources-on-same-grid.png',
      fullPage: true,
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 4 — Accepter/Refuser apparaissent AU CLIC, pas avant
    // ══════════════════════════════════════════════════════════════════
    await test.step('4. Accepter/Refuser révélés au clic, pas déjà visibles', async () => {
      const acceptButtonBeforeClick = studentPage.getByRole('button', {
        name: new RegExp(`^Accepter la proposition de cours.*avec ${teacherFirstName} ${teacherLastName}$`),
      })
      await expect(
        acceptButtonBeforeClick,
        'AVANT le clic : aucun bouton Accepter visible (changement demandé par l\'utilisateur)',
      ).toHaveCount(0)
      const declineButtonBeforeClick = studentPage.getByRole('button', {
        name: new RegExp(`^Refuser la proposition de cours.*avec ${teacherFirstName} ${teacherLastName}$`),
      })
      await expect(declineButtonBeforeClick, 'AVANT le clic : aucun bouton Refuser visible').toHaveCount(0)

      await expect(proposedBlock.getByText('Cliquer pour répondre')).toBeVisible()

      await proposedBlock.click()

      const acceptButton = studentPage.getByRole('button', {
        name: new RegExp(`^Accepter la proposition de cours.*avec ${teacherFirstName} ${teacherLastName}$`),
      })
      await expect(acceptButton, 'APRÈS le clic : le bouton Accepter apparaît').toBeVisible()
      const declineButton = studentPage.getByRole('button', {
        name: new RegExp(`^Refuser la proposition de cours.*avec ${teacherFirstName} ${teacherLastName}$`),
      })
      await expect(declineButton, 'APRÈS le clic : le bouton Refuser apparaît').toBeVisible()

      // 4bis. Preuve géométrique du correctif de clipping (bug réel du 2026-08-19) : les deux
      // boutons révélés doivent être réellement peints à l'écran, pas seulement présents dans
      // le DOM avec `toBeVisible() === true` (ce que Playwright ne suffit pas à garantir en
      // présence d'un rognage par un ancêtre `overflow: hidden`).
      await expectActuallyPaintedAtOwnLocation(
        acceptButton,
        'le bouton Accepter est réellement peint à l\'écran à son propre emplacement, pas rogné par le bloc parent',
      )
      await expectActuallyPaintedAtOwnLocation(
        declineButton,
        'le bouton Refuser est réellement peint à l\'écran à son propre emplacement, pas rogné par le bloc parent',
      )

      // Constat complémentaire : le bloc d'un créneau d'1h occupe une hauteur de grille très
      // réduite (07:00–22:00 sur ~600px) — mesure de la taille réelle rendue du bloc et du
      // bouton Accepter pour documenter la lisibilité effective, au-delà du simple "visible"
      // Playwright (qui ne détecte pas une compression visuelle extrême par flexbox).
      const blockBox = await proposedBlock.boundingBox()
      const acceptButtonBox = await acceptButton.boundingBox()
      console.log(
        `[Lisibilité] Bloc de proposition : ${JSON.stringify(blockBox)} — bouton Accepter : ${JSON.stringify(acceptButtonBox)}`,
      )

      await studentPage.screenshot({
        path: 'test-results/calendar-unified-03-accept-decline-revealed-on-click.png',
        fullPage: true,
      })
      // Capture rapprochée du seul bloc, pour que les libellés/boutons compressés restent
      // lisibles dans la preuve (le plein-écran ci-dessus les rend illisibles à l'œil nu).
      await proposedBlock.screenshot({
        path: 'test-results/calendar-unified-03bis-accept-decline-block-closeup.png',
      })

      // ── Clique Accepter : la proposition passe confirmée (réponse serveur réelle) ──
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

      const confirmedBlock = studentPage.locator('div.absolute.z-10.bg-indigo-100')
      await expect(confirmedBlock, 'bloc confirmé (couleur pleine) visible').toBeVisible({
        timeout: 15_000,
      })
      await expect(confirmedBlock, 'le bloc confirmé porte le nom du formateur').toContainText(
        `${teacherFirstName} ${teacherLastName}`,
      )

      // Le bouton "Rejoindre le cours" est TOUJOURS visible sur un créneau confirmé (pas révélé
      // au clic) — même famille de bug que Accepter/Refuser, mêmes deux niveaux de preuve.
      const joinButton = studentPage.getByRole('button', {
        name: new RegExp(`^Rejoindre le cours.*avec ${teacherFirstName} ${teacherLastName}$`),
      })
      await expect(joinButton, 'le bouton "Rejoindre le cours" apparaît sur le créneau confirmé').toBeVisible()
      await expectActuallyPaintedAtOwnLocation(
        joinButton,
        'le bouton "Rejoindre le cours" est réellement peint à l\'écran à son propre emplacement, pas rogné par le bloc parent',
      )
    })

    await studentPage.screenshot({
      path: 'test-results/calendar-unified-04-confirmed-slot.png',
      fullPage: true,
    })

    // ══════════════════════════════════════════════════════════════════
    // Point d'attention signalé par le développeur : la grille est un gabarit hebdomadaire
    // récurrent — un clic sur la case du jour de semaine COURANT, à une heure déjà passée
    // aujourd'hui, résout-il vers AUJOURD'HUI (dans le passé) sans avertissement ? Vérifié
    // seulement si une heure de grille (07:00–22:00) est déjà passée à l'heure où ce test
    // s'exécute — sinon, ce cas ne peut pas être observé aujourd'hui et l'étape est ignorée
    // proprement plutôt que de fabriquer un horaire artificiel.
    // ══════════════════════════════════════════════════════════════════
    const currentUtcHour = new Date().getUTCHours()
    const pastHourWithinGrid = currentUtcHour > 8 ? currentUtcHour - 1 : null

    if (pastHourWithinGrid !== null) {
      await test.step('Point d\'attention : clic sur AUJOURD\'HUI à une heure déjà passée', async () => {
        const todayDayOfWeek = new Date().getUTCDay()
        const todayDayLabel = DAY_LABELS_FR[todayDayOfWeek]
        const todayDayLabelLower = todayDayLabel.toLowerCase()
        const cellTime = `${pastHourWithinGrid.toString().padStart(2, '0')}:00`

        // Le `reload()` de l'étape 3bis a remonté `CalendarUnifiedView` : le mode d'interaction
        // repart à son défaut (« Consultation »), il faut donc rebasculer sur « Créer un
        // événement » avant de pouvoir cliquer une case vide.
        await studentPage.getByRole('tab', { name: 'Créer un événement' }).click()
        await expect(studentPage.getByRole('tab', { name: 'Créer un événement' })).toHaveAttribute(
          'aria-selected',
          'true',
        )

        await studentPage
          .getByRole('button', { name: `Ajouter un créneau ${todayDayLabelLower} à ${cellTime}` })
          .click()

        const pastEventDialog = studentPage.getByRole('dialog', { name: 'Créer un événement' })
        await expect(pastEventDialog).toBeVisible()

        const dateParagraph = pastEventDialog.locator('p.text-sm.text-gray-600').first()
        const pastDateLabelText = (await dateParagraph.textContent()) ?? ''
        console.log(
          `[Point d'attention] Case "${todayDayLabel} ${cellTime}" (heure déjà passée aujourd'hui) ` +
            `résolue vers : "${pastDateLabelText}"`,
        )

        // Corrigé le 2026-08-19 (décision utilisateur : avertir sans bloquer) : le popover
        // affiche désormais un avertissement explicite quand la date résolue est déjà passée.
        const warningLocator = pastEventDialog.getByText(/passé|déjà eu lieu/i)
        await expect(warningLocator).toBeVisible()
        await pastEventDialog.screenshot({
          path: 'test-results/calendar-unified-05-past-date-warning.png',
        })

        await pastEventDialog.getByRole('button', { name: 'Annuler' }).click()
        await expect(pastEventDialog).toBeHidden()
      })
    } else {
      console.log(
        "[Point d'attention] Heure d'exécution du test trop matinale (UTC) pour observer une case " +
          'déjà passée aujourd\'hui — étape ignorée proprement, pas de faux horaire fabriqué.',
      )
    }

    await studentContext.close()
  })
})

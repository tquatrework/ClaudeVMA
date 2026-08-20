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
 * Preuve à l'écran du scénario signalé par l'utilisateur : un formateur crée un événement
 * partagé avec un élève (sélecteur de destinataire de la modale de création), et l'élève ne
 * voyait jusqu'ici RIEN — ni sur son calendrier, ni notification, ni moyen d'accepter/refuser.
 *
 * Quatre correctifs livrés sur `fix/calendrier-creation-et-affichage` sont exercés bout en bout,
 * contre la pile réelle, aucune requête n'est simulée :
 *   1. `calendar-service` — `GET /calendars/:ownerId/events` renvoie aussi les événements où
 *      l'appelant est invité, avec `viewerInvitationStatus`. `DELETE .../events/:eventId` ajoutée.
 *   2. `dashboard-notification-service` — notification `event_invitation_received` à la création
 *      d'un événement avec destinataires, `metadata.creatorName` résolu (jamais un UUID).
 *   3. Front — bloc `EVENT_PENDING` (orange) sur la grille, `EventDetailDialog` avec
 *      Accepter/Refuser, bouton Supprimer pour le créateur d'un événement, `InvitationBanner`
 *      (composant mort) retiré.
 *   4. `calendar-service` (commit c76e098, trouvé PAR ce test le 2026-08-20 puis corrigé) —
 *      `CalendarEventCreated` porte désormais le vrai titre de l'événement dans son payload ;
 *      `metadata.title` n'est donc plus toujours `null`, et la cloche affiche le libellé
 *      « {creatorName} vous a invité à « {title} » » au lieu du libellé générique sans titre.
 *
 * Inspiré de `proof-calendar-fixes-2026-08-20.spec.ts` (même dossier, mêmes conventions).
 */

const PASSWORD = 'E2eTest!2026'
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

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

test.describe('Invitation à un événement de calendrier — visible, notifiée, actionnable (2026-08-20)', () => {
  test('le formateur invite un élève, l\'élève voit le bloc en attente, accepte, est notifié ; suppression testée', async ({
    browser,
  }) => {
    test.setTimeout(240_000)

    const uniqueSuffix = Date.now().toString()
    const studentFirstName = 'Nino'
    const studentLastName = `Invitetest${uniqueSuffix}`
    const teacherFirstName = 'Sacha'
    const teacherLastName = `Inviteprof${uniqueSuffix}`
    const eventTitle = `Invitation e2e ${uniqueSuffix}`

    // ── Préparation : comptes réels + relation TEACHER_OF_STUDENT (nécessaire pour que le
    // sélecteur de destinataire propose l'élève par son nom, EventRecipientPicker s'appuyant sur
    // `useMyContacts`) ──
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

    const teacherContext = await browser.newContext()
    const teacherPage = await teacherContext.newPage()
    const studentContext = await browser.newContext()
    const studentPage = await studentContext.newPage()

    let createdEventId: string | undefined

    try {
      // ══════════════════════════════════════════════════════════════
      // Étape 2 — le formateur crée un événement partagé avec l'élève, choisi PAR NOM
      // ══════════════════════════════════════════════════════════════
      await loginOnScreen(teacherPage, teacher.loginIdentifier, PASSWORD)
      await teacherPage.goto('/calendar')

      const eventTab = teacherPage.getByRole('tab', { name: 'Créer un événement' })
      await eventTab.click()
      await expect(eventTab).toHaveAttribute('aria-selected', 'true')

      const creationCell = teacherPage.getByRole('button', { name: 'Ajouter un créneau mercredi à 16:00' })
      await expect(creationCell, 'case de la grille ciblable pour créer un événement').toBeVisible()
      await creationCell.click()

      const createDialog = teacherPage.getByRole('dialog', { name: 'Créer un événement' })
      await expect(createDialog, 'la modale de création s\'ouvre').toBeVisible()

      // Type par défaut pour un formateur : "cours" (ALLOWED_EVENT_TYPES_BY_ROLE.formateur[0]).
      await expect(createDialog.locator('#event-create-type')).toHaveValue('cours')

      await createDialog.locator('#event-create-title').fill(eventTitle)

      // Destinataire choisi PAR NOM — jamais un UUID saisi ni affiché (arbitrage du 2026-08-09).
      const recipientSearch = createDialog.locator('#event-recipient-search')
      const studentFullName = `${studentFirstName} ${studentLastName}`
      await recipientSearch.fill(studentFirstName)

      const studentCandidateButton = createDialog.getByRole('button', { name: studentFullName })
      await expect(
        studentCandidateButton,
        'l\'élève lié apparaît comme destinataire proposable, par son nom',
      ).toBeVisible({ timeout: 15_000 })

      const busyResponsePromise = teacherPage.waitForResponse(
        (response) => /\/calendars\/.+\/busy(\?|$)/.test(response.url()) && response.request().method() === 'GET',
      )
      await studentCandidateButton.click()
      const busyResponse = await busyResponsePromise
      console.log(`GET /calendars/:ownerId/busy (destinataire) -> ${busyResponse.status()}`)
      expect(busyResponse.status(), 'prévisualisation busy/free de l\'élève choisi').toBe(200)

      await expect(createDialog.getByText(`Retirer ${studentFullName}`, { exact: true })).toBeVisible()
      expect(
        await createDialog.innerText(),
        'aucun UUID visible dans la modale de création (arbitrage du 2026-08-09)',
      ).not.toMatch(UUID_PATTERN)

      await createDialog.screenshot({
        path: 'test-results/invitation-fix-01-teacher-creates.png',
      })

      const createEventResponsePromise = teacherPage.waitForResponse(
        (response) =>
          /\/calendars\/.+\/events$/.test(response.url()) && response.request().method() === 'POST',
      )
      await createDialog.getByRole('button', { name: 'Créer' }).click()
      const createEventResponse = await createEventResponsePromise
      const createResponseBody = await createEventResponse.json().catch(() => null)
      console.log(
        `POST /calendars/:ownerId/events -> ${createEventResponse.status()} ${JSON.stringify(createResponseBody)}`,
      )
      expect(createEventResponse.status(), 'création de l\'événement avec destinataire').toBe(201)
      createdEventId = createResponseBody?.id
      expect(createdEventId, 'un id d\'événement a bien été renvoyé').toBeTruthy()

      await expect(createDialog, 'la modale se ferme après succès').toBeHidden()

      // ══════════════════════════════════════════════════════════════
      // Étape 6 (vérifiée tôt, pour laisser le temps au consommateur Redis asynchrone) —
      // notification reçue par l'élève, nom résolu, jamais un UUID
      // ══════════════════════════════════════════════════════════════
      const studentApiLogin = await login(student.loginIdentifier, PASSWORD)
      expect(studentApiLogin.status, 'connexion API élève, pour interroger ses notifications').toBe(201)
      const studentToken = studentApiLogin.body.access_token

      const notificationDelaySeconds = await waitForUnreadNotification(studentToken, 30_000, 2_000)
      console.log(
        notificationDelaySeconds >= 0
          ? `Notification reçue côté élève après ${notificationDelaySeconds}s (GET /notifications/unread-count > 0)`
          : 'AUCUNE notification reçue côté élève dans le délai imparti (30s)',
      )
      expect(notificationDelaySeconds, 'une notification doit arriver côté élève').toBeGreaterThanOrEqual(0)

      const { status: notificationsStatus, body: notificationsBody } = await listNotifications(studentToken)
      console.log(`GET /notifications (élève) -> ${notificationsStatus}`)
      const invitationNotification = notificationsBody.data.find(
        (notification) => notification.type === 'event_invitation_received',
      )
      expect(
        invitationNotification,
        'une notification event_invitation_received doit exister pour l\'élève',
      ).toBeTruthy()
      console.log(`Notification event_invitation_received : ${JSON.stringify(invitationNotification)}`)

      const creatorNameInMetadata = String(invitationNotification?.metadata?.creatorName ?? '')
      expect(
        creatorNameInMetadata,
        'metadata.creatorName doit être résolu (jamais un UUID)',
      ).not.toMatch(UUID_PATTERN)
      expect(creatorNameInMetadata, 'metadata.creatorName doit contenir le nom du formateur').toContain(
        teacherFirstName,
      )
      expect(invitationNotification?.metadata?.eventId, 'metadata.eventId doit désigner cet événement').toBe(
        createdEventId,
      )

      // ══════════════════════════════════════════════════════════════
      // Étape 3/4 — l'élève se connecte APRÈS la confirmation ci-dessus (le contexte de
      // notifications ne charge qu'une fois au montage, règle du 2026-08-10 : la notification
      // doit déjà exister côté serveur avant ce login pour apparaître dans la cloche sans reload)
      // ══════════════════════════════════════════════════════════════
      await loginOnScreen(studentPage, student.loginIdentifier, PASSWORD)
      await studentPage.goto('/calendar')

      // Aucune ancienne bannière/liste d'invitations ne doit traîner (InvitationBanner, composant
      // mort, retiré le 2026-08-20 — il testait `eventType === "invitation"` et un champ
      // `inviteeStatus` que le serveur n'a jamais renvoyé).
      await expect(
        studentPage.getByRole('region', { name: 'Invitations en attente' }),
        'l\'ancienne bannière InvitationBanner ne doit plus exister',
      ).toHaveCount(0)
      await expect(studentPage.getByText(/Invitations en attente/)).toHaveCount(0)

      // Preuve directe que « rien n'apparaît » est résolu : bloc EVENT_PENDING (orange) sur la
      // propre grille de l'élève.
      const pendingBlock = studentPage.locator('div.bg-orange-50', { hasText: eventTitle })
      await expect(pendingBlock, 'le bloc en attente (orange, EVENT_PENDING) est visible').toBeVisible({
        timeout: 15_000,
      })
      await expect(studentPage.getByText('Invitation — cliquer pour répondre')).toBeVisible()

      await studentPage.screenshot({
        path: 'test-results/invitation-fix-02-student-sees-pending-block.png',
        fullPage: true,
      })

      // ══════════════════════════════════════════════════════════════
      // Étape 5 — clic sur le bloc → modale Accepter/Refuser
      // ══════════════════════════════════════════════════════════════
      await pendingBlock.click()

      const detailDialog = studentPage.getByRole('dialog', { name: "Détail de l'événement" })
      await expect(detailDialog, 'la modale de détail s\'ouvre au clic sur le bloc en attente').toBeVisible()
      await expect(detailDialog.getByRole('button', { name: 'Accepter' })).toBeVisible()
      await expect(detailDialog.getByRole('button', { name: 'Refuser' })).toBeVisible()

      await detailDialog.screenshot({ path: 'test-results/invitation-fix-03-accept-modal.png' })

      const acceptResponsePromise = studentPage.waitForResponse(
        (response) =>
          /\/events\/.+\/invitees\/.+\/accept$/.test(response.url()) &&
          response.request().method() === 'POST',
      )
      await detailDialog.getByRole('button', { name: 'Accepter' }).click()
      const acceptResponse = await acceptResponsePromise
      console.log(`POST /events/:id/invitees/:userId/accept -> ${acceptResponse.status()}`)
      expect([200, 201], 'acceptation de l\'invitation').toContain(acceptResponse.status())

      await expect(detailDialog, 'la modale se ferme après acceptation réussie').toBeHidden()

      // Le bloc n'est plus en couleur "en attente" — état rechargé depuis le serveur
      // (`respondToEventInvitation` appelle `refetch()`, jamais un état optimiste local).
      await expect(
        studentPage.locator('div.bg-orange-50', { hasText: eventTitle }),
        'plus aucun bloc orange pour cet événement après acceptation',
      ).toHaveCount(0)
      const acceptedBlock = studentPage.locator('div.bg-rose-50', { hasText: eventTitle })
      await expect(acceptedBlock, 'le bloc réapparaît en couleur normale (EVENT, rose)').toBeVisible()

      await studentPage.screenshot({
        path: 'test-results/invitation-fix-04-accepted-block-changed.png',
        fullPage: true,
      })

      // ══════════════════════════════════════════════════════════════
      // Étape 6 (capture écran) — la cloche affiche le libellé français, nom résolu, AVEC titre
      //
      // DÉFAUT CORRIGÉ (constaté par ce test le 2026-08-20, corrigé côté calendar-service commit
      // c76e098 : `CalendarEventCreated` porte désormais le vrai titre de l'événement dans son
      // payload). `metadata.title` doit donc désormais valoir le titre réel de l'événement créé,
      // et non plus `null` — la cloche affiche le libellé AVEC titre documenté dans
      // `notificationLabels.ts` : « {creatorName} vous a invité à « {title} » », et non plus le
      // libellé générique « … à un événement » qui ne doit s'afficher qu'en l'absence de titre.
      // ══════════════════════════════════════════════════════════════
      expect(
        invitationNotification?.metadata?.title,
        'metadata.title doit désormais être égal au titre réel de l\'événement créé (corrigé)',
      ).toBe(eventTitle)

      const bellButton = studentPage.getByRole('button', { name: /Notifications/ })
      await bellButton.click()
      const expectedBellText = `${teacherFirstName} ${teacherLastName} vous a invité à « ${eventTitle} »`
      await expect(studentPage.getByText(expectedBellText)).toBeVisible()
      await studentPage.screenshot({ path: 'test-results/invitation-fix-05-notification.png' })
      await bellButton.click() // referme le menu, pour ne pas gêner la suite

      // ══════════════════════════════════════════════════════════════
      // Étape 7a — bouton de suppression sur un événement créé par le formateur lui-même
      // ══════════════════════════════════════════════════════════════
      const teacherOwnBlock = teacherPage.locator('div.bg-rose-50', { hasText: eventTitle })
      await expect(teacherOwnBlock, 'l\'événement créé apparaît toujours sur le calendrier du formateur').toBeVisible()
      await teacherOwnBlock.click()

      const teacherDetailDialog = teacherPage.getByRole('dialog', { name: "Détail de l'événement" })
      await expect(teacherDetailDialog).toBeVisible()
      const deleteEventButton = teacherDetailDialog.getByRole('button', { name: "Supprimer l'événement" })
      await expect(deleteEventButton, 'le bouton Supprimer est visible pour le créateur').toBeVisible()

      await teacherDetailDialog.screenshot({ path: 'test-results/invitation-fix-06-delete-event.png' })

      const deleteEventResponsePromise = teacherPage.waitForResponse(
        (response) =>
          /\/calendars\/.+\/events\/.+$/.test(response.url()) && response.request().method() === 'DELETE',
      )
      await deleteEventButton.click()
      const deleteEventResponse = await deleteEventResponsePromise
      console.log(`DELETE /calendars/:ownerId/events/:eventId -> ${deleteEventResponse.status()}`)
      expect(deleteEventResponse.status(), 'suppression de l\'événement par son créateur').toBe(204)

      await expect(teacherDetailDialog, 'la modale se ferme après suppression').toBeHidden()
      await expect(
        teacherPage.locator('div', { hasText: eventTitle }).filter({ has: teacherPage.locator('span') }),
        'l\'événement supprimé ne réapparaît plus sur la grille',
      ).toHaveCount(0)

      // ══════════════════════════════════════════════════════════════
      // Étape 7b — régression : le bouton Supprimer d'une disponibilité fonctionne toujours
      // ══════════════════════════════════════════════════════════════
      const availabilityTab = teacherPage.getByRole('tab', { name: 'Indiquer une disponibilité' })
      await availabilityTab.click()
      await expect(availabilityTab).toHaveAttribute('aria-selected', 'true')

      const availabilityCell = teacherPage.getByRole('button', { name: 'Ajouter un créneau vendredi à 17:00' })
      await expect(availabilityCell).toBeVisible()
      await availabilityCell.click()

      const availabilityCreateDialog = teacherPage.getByRole('dialog', { name: 'Nouveau créneau' })
      await expect(availabilityCreateDialog).toBeVisible()
      await availabilityCreateDialog.getByRole('button', { name: 'Créer' }).click()
      await expect(availabilityCreateDialog).toBeHidden()

      const availabilityBlock = teacherPage.getByRole('button', {
        name: 'Modifier le créneau vendredi 17:00 – 18:00 — Disponible',
      })
      await expect(availabilityBlock, 'le créneau de disponibilité créé apparaît sur la grille').toBeVisible()
      await availabilityBlock.click()

      const availabilityEditDialog = teacherPage.getByRole('dialog', { name: 'Modifier le créneau' })
      await expect(availabilityEditDialog).toBeVisible()
      const deleteAvailabilityButton = availabilityEditDialog.getByRole('button', { name: 'Supprimer' })
      await expect(deleteAvailabilityButton, 'le bouton Supprimer existant fonctionne toujours').toBeVisible()

      await availabilityEditDialog.screenshot({ path: 'test-results/invitation-fix-07-delete-availability.png' })

      const deleteSlotResponsePromise = teacherPage.waitForResponse(
        (response) =>
          /\/calendars\/.+\/availability-slots\/.+$/.test(response.url()) &&
          response.request().method() === 'DELETE',
      )
      await deleteAvailabilityButton.click()
      const deleteSlotResponse = await deleteSlotResponsePromise
      console.log(`DELETE /calendars/:ownerId/availability-slots/:slotId -> ${deleteSlotResponse.status()}`)
      expect(deleteSlotResponse.status(), 'suppression du créneau de disponibilité (pas de régression)').toBe(204)

      await expect(availabilityEditDialog, 'la modale se ferme après suppression').toBeHidden()
      await expect(
        teacherPage.getByRole('button', { name: 'Modifier le créneau vendredi 17:00 – 18:00 — Disponible' }),
        'le créneau supprimé ne réapparaît plus sur la grille',
      ).toHaveCount(0)
    } finally {
      await teacherContext.close()
      await studentContext.close()
    }
  })
})

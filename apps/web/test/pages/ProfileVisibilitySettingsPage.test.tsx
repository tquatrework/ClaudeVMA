/**
 * Tests de ProfileVisibilitySettingsPage — visibilité champ par champ
 * (`GET|PUT /profiles/:userId/field-visibility`).
 *
 * L'écran a changé de contrat : `visibility-preferences` et ses booléens nommés
 * en dur (`showEmailToTeachers`…) ont été supprimés côté serveur (`404`
 * désormais). Le serveur renvoie maintenant le **catalogue complet** des champs,
 * groupés par `block`, avec `audience` et `defaultAudience`.
 *
 * Propriétés gardées ici :
 *
 * 1. le front ne duplique **ni la liste des champs ni les défauts** — il n'affiche
 *    que ce que le serveur lui envoie, un catalogue tronqué produit un écran
 *    tronqué et rien d'inventé ;
 * 2. l'enregistrement est un **upsert partiel** — seuls les champs réellement
 *    changés partent, jamais le catalogue entier ;
 * 3. `firstName`/`lastName` ne sont **plus réglables** ici (arbitrage du
 *    2026-08-17, précisé le 2026-08-18) — mais restent **affichés**, en dur
 *    côté front, grisés et verrouillés sur « Tous les membres », sans aucun
 *    sélecteur actif, et **jamais envoyés en `PUT`**, même si le catalogue
 *    serveur les contient encore ;
 * 4. seul le bloc pédagogique du **rôle réel du titulaire consulté** s'affiche
 *    (élève → `pedagogical-student`, formateur → `pedagogical-teacher`), jamais
 *    les deux — filtré côté front quel que soit le catalogue reçu.
 *
 * Les libellés affichés sont en français (règle projet du 2026-08-09) et viennent
 * du point unique `src/utils/profileFieldLabels.ts`.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileVisibilitySettingsPage from '../../src/pages/ProfileVisibilitySettingsPage'
import type { FieldVisibilityEntry, FieldVisibilitySettings, Profile } from '../../src/types/profile'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchFieldVisibility, fetchProfile, updateFieldVisibility } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchFieldVisibility = vi.mocked(fetchFieldVisibility)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockUpdateFieldVisibility = vi.mocked(updateFieldVisibility)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

/**
 * Réponse par défaut de `GET /profiles/:userId` : `pedagogicalType` et
 * `pedagogical` à `null`, comme un compte n'ayant pas encore renseigné son
 * profil pédagogique (état normal, arbitrage du 2026-08-07). Sur son PROPRE
 * profil, `resolvePedagogicalProfileKind` retombe alors sur le rôle de
 * l'appelant — c'est ce chemin que la majorité des tests ci-dessous exercent.
 */
function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    userId: 'student-1',
    pedagogicalType: null,
    pedagogical: null,
    ...overrides,
  }
}

function buildAuthMock(userObj = STUDENT_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(userObj.role),
    ),
  }
}

function buildEntry(overrides: Partial<FieldVisibilityEntry> & { fieldName: string }) {
  return {
    block: 'administrative' as const,
    audience: 'self' as const,
    defaultAudience: 'self' as const,
    isExplicit: false,
    isPrescription: false,
    isReserved: false,
    ...overrides,
  }
}

/**
 * Extrait représentatif du catalogue serveur : un champ visible par défaut, un
 * champ masqué par défaut, un champ réglé explicitement, un champ de
 * prescription, un champ réservé, et deux blocs pédagogiques distincts.
 */
const CATALOG_FIELDS: FieldVisibilityEntry[] = [
  buildEntry({ fieldName: 'firstName', audience: 'linked', defaultAudience: 'linked' }),
  buildEntry({ fieldName: 'phone' }),
  buildEntry({
    fieldName: 'birthDate',
    audience: 'all',
    defaultAudience: 'self',
    isExplicit: true,
  }),
  buildEntry({
    fieldName: 'level',
    block: 'pedagogical-student',
    audience: 'linked',
    defaultAudience: 'linked',
  }),
  buildEntry({ fieldName: 'difficulties', block: 'pedagogical-student' }),
  buildEntry({
    fieldName: 'recommendedTeacherProfile',
    block: 'pedagogical-student',
    isPrescription: true,
  }),
  buildEntry({ fieldName: 'comments', block: 'pedagogical-student', isReserved: true }),
  buildEntry({ fieldName: 'diplomas', block: 'pedagogical-teacher' }),
]

const CATALOG: FieldVisibilitySettings = {
  userId: 'student-1',
  fields: CATALOG_FIELDS,
}

function renderPage(userId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${userId}/visibility`]}>
      <Routes>
        <Route path="/profiles/:userId/visibility" element={<ProfileVisibilitySettingsPage />} />
        <Route path="/profiles/:userId" element={<div>Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Groupe de boutons radio d'un champ, ciblé par son libellé français. */
function audienceRadiosOf(fieldName: string): HTMLInputElement[] {
  return screen.getAllByRole('radio', { name: /./ }).filter((radio) => {
    return (radio as HTMLInputElement).name === `visibility-${fieldName}`
  }) as HTMLInputElement[]
}

async function selectAudience(fieldName: string, audienceLabel: RegExp) {
  const radios = audienceRadiosOf(fieldName)
  const target = radios.find((radio) => audienceLabel.test(radio.parentElement?.textContent ?? ''))
  if (!target) throw new Error(`Aucun choix ${audienceLabel} pour le champ ${fieldName}`)
  await userEvent.click(target)
}

async function clickSave() {
  await userEvent.click(await screen.findByRole('button', { name: /^enregistrer$/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchProfile.mockResolvedValue(buildProfile())
})

describe('ProfileVisibilitySettingsPage', () => {
  it('shows loading state while fetching the catalog', () => {
    mockFetchFieldVisibility.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('groups the fields by block, with French section titles — only the block of the real role of the profile owner', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    // Élève sur son propre profil : le bloc pédagogique formateur ne le concerne
    // jamais, même si le catalogue serveur le contient encore.
    mockFetchProfile.mockResolvedValue(buildProfile({ pedagogicalType: null, pedagogical: null }))

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Confidentialité')).toBeDefined()
    })
    expect(screen.getByRole('heading', { name: 'Informations administratives' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Profil pédagogique — élève' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Profil pédagogique — formateur' })).toBeNull()
  })

  it('shows only the teacher block on a teacher’s own profile', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchFieldVisibility.mockResolvedValue({ ...CATALOG, userId: 'teacher-1' })
    mockFetchProfile.mockResolvedValue(
      buildProfile({ userId: 'teacher-1', pedagogicalType: null, pedagogical: null }),
    )

    renderPage('teacher-1')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profil pédagogique — formateur' })).toBeDefined()
    })
    expect(screen.queryByRole('heading', { name: 'Profil pédagogique — élève' })).toBeNull()
    expect(screen.getByText('Diplômes et certifications')).toBeDefined()
  })

  it('trusts the server-declared pedagogicalType over a mismatched viewer role (RP consulting a third party)', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    // Le RP consulte la fiche d'un formateur : `pedagogicalType` du serveur fait
    // foi, le rôle de l'appelant (RP) n'est jamais utilisé pour un tiers.
    mockFetchProfile.mockResolvedValue(buildProfile({ pedagogicalType: 'teacher' }))

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profil pédagogique — formateur' })).toBeDefined()
    })
    expect(screen.queryByRole('heading', { name: 'Profil pédagogique — élève' })).toBeNull()
  })

  it('always shows firstName/lastName, greyed out and locked on "Tous les membres", with no selector', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Téléphone')).toBeDefined()
    })
    // Affichés, contrairement à avant le 2026-08-18 : l'utilisateur doit
    // pouvoir constater que son prénom et son nom sont toujours visibles.
    const firstNameLabel = screen.getByText('Prénom')
    const lastNameLabel = screen.getByText('Nom')
    expect(firstNameLabel).toBeDefined()
    expect(lastNameLabel).toBeDefined()

    // Aucun sélecteur actif : pas de boutons radio pour ces deux champs.
    expect(audienceRadiosOf('firstName')).toHaveLength(0)
    expect(audienceRadiosOf('lastName')).toHaveLength(0)

    // Verrouillés sur "Tous les membres" — même libellé que partout ailleurs
    // sur cet écran pour le public `all` — avec une indication du pourquoi.
    const firstNameRow = firstNameLabel.closest('li') as HTMLElement
    const lastNameRow = lastNameLabel.closest('li') as HTMLElement
    expect(within(firstNameRow).getByText('Tous les membres')).toBeDefined()
    expect(within(firstNameRow).getByText('Toujours visible, non modifiable')).toBeDefined()
    expect(within(lastNameRow).getByText('Tous les membres')).toBeDefined()
    expect(within(lastNameRow).getByText('Toujours visible, non modifiable')).toBeDefined()
  })

  it('never sends firstName/lastName in a PUT, even though the server catalog still carries them', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockUpdateFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('phone')).toHaveLength(3)
    })
    await selectAudience('phone', /mes contacts liés/i)
    await clickSave()

    await waitFor(() => {
      expect(mockUpdateFieldVisibility).toHaveBeenCalled()
    })
    const [, sentFields] = mockUpdateFieldVisibility.mock.calls[0]
    expect(sentFields.some((field) => field.fieldName === 'firstName')).toBe(false)
    expect(sentFields.some((field) => field.fieldName === 'lastName')).toBe(false)
  })

  it('labels every visible field in French, technical names never shown', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Téléphone')).toBeDefined()
    })
    expect(screen.getByText('Difficultés rencontrées')).toBeDefined()
    expect(screen.getByText('Type de formateur préconisé')).toBeDefined()
    // Les noms techniques de l'API ne fuient jamais à l'écran.
    expect(screen.queryByText('difficulties')).toBeNull()
    expect(screen.queryByText('recommendedTeacherProfile')).toBeNull()
    // Bloc formateur : hors du rôle de l'élève, jamais affiché ici.
    expect(screen.queryByText('Diplômes et certifications')).toBeNull()
  })

  it('displays only the fields sent by the server, and invents none', async () => {
    mockFetchFieldVisibility.mockResolvedValue({
      userId: 'student-1',
      fields: [buildEntry({ fieldName: 'phone', audience: 'linked' })],
    })

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Téléphone')).toBeDefined()
    })
    // Le catalogue et les défauts appartiennent au serveur : un catalogue
    // tronqué donne un écran tronqué, pas une liste recopiée côté front.
    expect(screen.queryByText('Adresse (ligne 1)')).toBeNull()
    expect(screen.queryByText('Difficultés rencontrées')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Profil pédagogique — élève' })).toBeNull()
  })

  it('offers the three audiences and pre-selects the effective one', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('phone')).toHaveLength(3)
    })

    const phoneRadios = audienceRadiosOf('phone')
    expect(phoneRadios.map((radio) => radio.value)).toEqual(['self', 'linked', 'all'])
    // Tout est `self` par défaut, sauf réglage explicite.
    expect(phoneRadios.find((radio) => radio.checked)?.value).toBe('self')
    // Réglage explicite du titulaire : il prime sur le défaut.
    expect(audienceRadiosOf('birthDate').find((radio) => radio.checked)?.value).toBe('all')
    // Champ du socle "linked" par défaut, non explicite.
    expect(audienceRadiosOf('level').find((radio) => radio.checked)?.value).toBe('linked')
  })

  it('shows the default only for fields the user has not set explicitly', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Téléphone')).toBeDefined()
    })
    expect(screen.getAllByText(/Réglage par défaut : Moi seul/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Réglage par défaut : Tous les membres/)).toBeNull()
  })

  it('signals prescription and reserved fields without hiding them', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Type de formateur préconisé')).toBeDefined()
    })
    expect(screen.getByText('Rédigé par le responsable pédagogique')).toBeDefined()
    expect(screen.getByText('Champ prévu, pas encore utilisé sur la plateforme')).toBeDefined()
  })

  it('keeps the save button disabled until something actually changes', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    const saveButton = (await screen.findByRole('button', {
      name: /^enregistrer$/i,
    })) as HTMLButtonElement
    await waitFor(() => {
      expect(saveButton.disabled).toBe(true)
    })

    await selectAudience('phone', /mes contacts liés/i)

    await waitFor(() => {
      expect(saveButton.disabled).toBe(false)
    })
    expect(screen.getByText('1 modification en attente')).toBeDefined()
  })

  it('sends only the changed fields (partial upsert)', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockUpdateFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('phone')).toHaveLength(3)
    })

    await selectAudience('phone', /mes contacts liés/i)
    await selectAudience('difficulties', /tous les membres/i)
    await clickSave()

    await waitFor(() => {
      expect(mockUpdateFieldVisibility).toHaveBeenCalledWith('student-1', [
        { fieldName: 'phone', audience: 'linked' },
        { fieldName: 'difficulties', audience: 'all' },
      ])
    })
    // Les six autres champs du catalogue ne repartent pas : l'écriture est un
    // upsert partiel, pas un remplacement du catalogue.
    const [, sentFields] = mockUpdateFieldVisibility.mock.calls[0]
    expect(sentFields).toHaveLength(2)
  })

  it('lets a field go back to its default audience', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockUpdateFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('birthDate')).toHaveLength(3)
    })

    // `birthDate` est réglé sur `all` alors que son défaut est `self` : revenir
    // au défaut, c'est renvoyer explicitement `defaultAudience`.
    await selectAudience('birthDate', /moi seul/i)
    await clickSave()

    await waitFor(() => {
      expect(mockUpdateFieldVisibility).toHaveBeenCalledWith('student-1', [
        { fieldName: 'birthDate', audience: 'self' },
      ])
    })
  })

  it('shows a success message after saving', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockUpdateFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('phone')).toHaveLength(3)
    })
    await selectAudience('phone', /mes contacts liés/i)
    await clickSave()

    await waitFor(() => {
      expect(screen.getByText('Réglages de confidentialité enregistrés')).toBeDefined()
    })
  })

  it('explains a 403 on save without claiming success', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockUpdateFieldVisibility.mockRejectedValue({ response: { status: 403, data: {} } })

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('phone')).toHaveLength(3)
    })
    await selectAudience('phone', /mes contacts liés/i)
    await clickSave()

    await waitFor(() => {
      expect(
        screen.getByText("Vous n'êtes pas autorisé à modifier ces réglages de confidentialité."),
      ).toBeDefined()
    })
    expect(screen.queryByText('Réglages de confidentialité enregistrés')).toBeNull()
  })

  it('reports a rejected field name coming back as a 400', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockUpdateFieldVisibility.mockRejectedValue({
      response: { status: 400, data: { message: 'fieldName must be one of the catalog fields' } },
    })

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('phone')).toHaveLength(3)
    })
    await selectAudience('phone', /mes contacts liés/i)
    await clickSave()

    await waitFor(() => {
      expect(screen.getByText(/fieldName must be one of the catalog fields/)).toBeDefined()
    })
  })

  it('surfaces a load failure instead of showing an empty screen', async () => {
    mockFetchFieldVisibility.mockRejectedValue({ response: { status: 403, data: {} } })

    renderPage('student-1')

    await waitFor(() => {
      expect(
        screen.getByText("Vous n'êtes pas autorisé à consulter ces réglages de confidentialité."),
      ).toBeDefined()
    })
  })

  it('states plainly when the catalog is empty', async () => {
    mockFetchFieldVisibility.mockResolvedValue({ userId: 'student-1', fields: [] })

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Aucun champ à régler pour ce compte.')).toBeDefined()
    })
  })

  it('shows "Accès refusé" for a parent looking at someone else’s settings', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    expect(screen.getByText('Accès refusé')).toBeDefined()
    // Aucun appel n'est tenté : on n'ouvre pas une porte qui répondrait 403.
    expect(mockFetchFieldVisibility).not.toHaveBeenCalled()
    expect(mockFetchProfile).not.toHaveBeenCalled()
  })

  it('allows a pedagogical manager to open any student settings, filtered on the student’s own block', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockFetchProfile.mockResolvedValue(buildProfile({ pedagogicalType: 'student' }))

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Confidentialité')).toBeDefined()
    })
    expect(mockFetchFieldVisibility).toHaveBeenCalledWith('student-1')
    expect(mockFetchProfile).toHaveBeenCalledWith('student-1')
    expect(screen.getByRole('heading', { name: 'Profil pédagogique — élève' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Profil pédagogique — formateur' })).toBeNull()
  })

  it('navigates back to the profile page', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    renderPage('student-1')

    const backLink = await screen.findByText(/retour au profil/i)
    await userEvent.click(backLink)

    await waitFor(() => {
      expect(screen.getByText('Profile Page')).toBeDefined()
    })
  })

  it('disables the choices while the save is in flight', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)
    mockUpdateFieldVisibility.mockReturnValue(new Promise(() => {}))

    renderPage('student-1')

    await waitFor(() => {
      expect(audienceRadiosOf('phone')).toHaveLength(3)
    })
    await selectAudience('phone', /mes contacts liés/i)
    await clickSave()

    await waitFor(() => {
      expect(audienceRadiosOf('phone').every((radio) => radio.disabled)).toBe(true)
    })
    const saveButton = screen.getByRole('button', { name: /enregistrement/i }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
  })

  it('règle les quatre champs élève ajoutés le 2026-08-11, sous leur libellé français', async () => {
    // Relevé sur la pile réelle le 2026-08-11 (`GET .../field-visibility`,
    // HTTP 200, 36 entrées) : ces quatre champs sont au catalogue, hors socle
    // (`defaultAudience: 'self'`). Sans libellé au point unique, l'écran
    // afficherait « School name » et « Family context ».
    mockFetchFieldVisibility.mockResolvedValue({
      userId: 'student-1',
      fields: [
        buildEntry({ fieldName: 'schoolName', block: 'pedagogical-student' }),
        buildEntry({ fieldName: 'familyContext', block: 'pedagogical-student' }),
        buildEntry({ fieldName: 'schoolContext', block: 'pedagogical-student' }),
        buildEntry({ fieldName: 'equipment', block: 'pedagogical-student' }),
      ],
    })

    renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Établissement')).toBeDefined()
    })
    expect(screen.getByText('Contexte familial')).toBeDefined()
    expect(screen.getByText('Contexte scolaire')).toBeDefined()
    expect(screen.getByText('Matériel (lieu des cours, équipement)')).toBeDefined()

    // Chacun est réglable comme les autres : trois publics proposés.
    for (const fieldName of ['schoolName', 'familyContext', 'schoolContext', 'equipment']) {
      expect(audienceRadiosOf(fieldName)).toHaveLength(3)
    }
    // Champs supprimés côté serveur : plus rien à régler à leur sujet.
    expect(screen.queryByText('Contexte scolaire et familial')).toBeNull()
    expect(screen.queryByText('Département')).toBeNull()
  })

  it('keeps every visible field group rendered inside one form', async () => {
    mockFetchFieldVisibility.mockResolvedValue(CATALOG)

    const { container } = renderPage('student-1')

    await waitFor(() => {
      expect(screen.getByText('Téléphone')).toBeDefined()
    })
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    expect(within(form as HTMLElement).getByText('Difficultés rencontrées')).toBeDefined()
  })
})

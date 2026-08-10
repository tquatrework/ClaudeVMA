/**
 * Tests de l'emplacement photo (`ProfileAvatarField` + `useProfileAvatar`).
 *
 * Cinq comportements y sont gardés, chacun correspondant à un piège identifié
 * avant l'implémentation :
 *
 * 1. la photo n'est **pas** posée dans un `<img src={avatarUrl}>` : la route
 *    étant authentifiée par l'en-tête `Authorization`, le navigateur n'y
 *    enverrait aucun jeton. Les octets sont demandés puis transformés en object
 *    URL ;
 * 2. cet object URL est **révoqué** au démontage et à chaque remplacement,
 *    faute de quoi chaque navigation laisse un blob en mémoire ;
 * 3. un `404` — pas de photo **ou** photo masquée — affiche un substitut neutre,
 *    jamais un message qui trancherait entre les deux ;
 * 4. un `413` produit un message français parlant de poids de fichier ;
 * 5. après un remplacement, c'est l'`avatarUrl` **renvoyé par le serveur** qui
 *    est réutilisé, jeton `?v=` compris ;
 * 6. la limite d'envoi est **annoncée avant** le choix du fichier, lue au
 *    serveur, et un fichier trop lourd est refusé **sans appel réseau**.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProfileAvatarField } from '../../src/components/profile/ProfileAvatarField'

vi.mock('../../src/api/profile')

import {
  deleteProfileAvatar,
  fetchProfileAvatarBlob,
  fetchProfileAvatarConstraints,
  uploadProfileAvatar,
} from '../../src/api/profile'

const mockFetchProfileAvatarBlob = vi.mocked(fetchProfileAvatarBlob)
const mockFetchProfileAvatarConstraints = vi.mocked(fetchProfileAvatarConstraints)
const mockUploadProfileAvatar = vi.mocked(uploadProfileAvatar)
const mockDeleteProfileAvatar = vi.mocked(deleteProfileAvatar)

const USER_ID = '464da8a2-8b4f-4cc7-b7b1-f1d0ab511355'
const AVATAR_URL = `/api/v1/profiles/${USER_ID}/avatar?v=1754820000000`
const REPLACED_AVATAR_URL = `/api/v1/profiles/${USER_ID}/avatar?v=1754899999999`

/** Contraintes telles que publiées aujourd'hui par `profile-service`. */
const SERVER_CONSTRAINTS = {
  maxUploadBytes: 1_000_000,
  acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  outputContentType: 'image/webp',
  maxDimensionPixels: 512,
}

function makePhotoBlob() {
  return new Blob(['octets'], { type: 'image/webp' })
}

/**
 * Fichier de test. La taille est forcée quand elle compte, sans allouer les
 * mégaoctets correspondants.
 */
function makePhotoFile(sizeInBytes?: number) {
  const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
  if (sizeInBytes !== undefined) Object.defineProperty(file, 'size', { value: sizeInBytes })
  return file
}

/** Attend que les contraintes annoncées viennent bien du serveur. */
async function waitForConstraints() {
  await waitFor(() => {
    expect(mockFetchProfileAvatarConstraints).toHaveBeenCalled()
  })
}

function renderField(overrides: Partial<React.ComponentProps<typeof ProfileAvatarField>> = {}) {
  return render(
    <ProfileAvatarField
      userId={USER_ID}
      avatarUrl={null}
      displayName="Alice Martin"
      canEdit
      {...overrides}
    />,
  )
}

/** Sélectionne un fichier dans le champ caché, comme le ferait l'utilisateur. */
function selectFile(file: File) {
  const fileInput = screen.getByLabelText(/photo/i) as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [file] } })
}

let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL')
  mockFetchProfileAvatarConstraints.mockResolvedValue(SERVER_CONSTRAINTS)
})

afterEach(() => {
  revokeObjectUrlSpy.mockRestore()
})

describe('ProfileAvatarField — affichage', () => {
  it('affiche la photo récupérée en octets, avec le jeton de version', async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())

    renderField({ avatarUrl: AVATAR_URL })

    const photo = await screen.findByRole('img', { name: /Alice Martin/ })
    // Jamais l'URL de l'API : elle serait appelée sans en-tête d'authentification.
    expect(photo.getAttribute('src')).toMatch(/^blob:/)
    expect(mockFetchProfileAvatarBlob).toHaveBeenCalledWith(USER_ID, '1754820000000')
  })

  it("n'appelle pas le serveur quand aucune photo n'est annoncée", async () => {
    renderField({ avatarUrl: null })
    await waitForConstraints()

    expect(mockFetchProfileAvatarBlob).not.toHaveBeenCalled()
    expect(screen.getByTestId('profile-avatar-initials').textContent).toBe('AM')
  })

  it('affiche un substitut neutre sur un 404, sans affirmer de cause', async () => {
    // Absence de photo et masquage par le titulaire sont indiscernables côté
    // serveur, volontairement : l'écran ne doit pas prétendre savoir laquelle.
    mockFetchProfileAvatarBlob.mockRejectedValue({ response: { status: 404 } })

    renderField({ avatarUrl: AVATAR_URL, canEdit: false })

    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-initials')).toBeDefined()
    })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText(/masqué/i)).toBeNull()
    expect(screen.queryByText(/pas encore/i)).toBeNull()
  })

  it("dit au titulaire, et à lui seul, qu'il n'a pas encore de photo", async () => {
    mockFetchProfileAvatarBlob.mockRejectedValue({ response: { status: 404 } })

    renderField({ avatarUrl: AVATAR_URL, canEdit: true })

    expect(await screen.findByText(/pas encore ajouté de photo/i)).toBeDefined()
  })

  it("affiche un message d'échec quand la lecture échoue vraiment", async () => {
    mockFetchProfileAvatarBlob.mockRejectedValue({ response: { status: 500 } })

    renderField({ avatarUrl: AVATAR_URL })

    expect(await screen.findByText(/réessayer/i)).toBeDefined()
  })

  it("se replie sur « ? » quand aucun nom n'est lisible — jamais un identifiant", async () => {
    renderField({ avatarUrl: null, displayName: null })
    await waitForConstraints()

    expect(screen.getByTestId('profile-avatar-initials').textContent).toBe('?')
    expect(screen.queryByText(USER_ID)).toBeNull()
  })
})

describe('ProfileAvatarField — droits', () => {
  it("ne propose aucune action à un lecteur qui n'est pas le titulaire", async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())

    renderField({ avatarUrl: AVATAR_URL, canEdit: false })

    await screen.findByRole('img', { name: /Alice Martin/ })
    // Une porte qui répondrait 403 ne doit pas être affichée du tout.
    expect(screen.queryByLabelText(/photo/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })

  it('propose « Ajouter une photo » au titulaire qui n’en a pas', async () => {
    renderField({ avatarUrl: null })
    await waitForConstraints()

    expect(screen.getByLabelText('Ajouter une photo')).toBeDefined()
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })
})

describe('ProfileAvatarField — limite annoncée avant le choix du fichier', () => {
  it('affiche la taille maximale et les formats, lus au serveur', async () => {
    renderField({ avatarUrl: null })

    expect(await screen.findByText('Taille maximale : 1 Mo.')).toBeDefined()
    expect(screen.getByText(/Formats acceptés : JPEG, PNG, WebP, GIF ou AVIF\./)).toBeDefined()
    expect(mockFetchProfileAvatarConstraints).toHaveBeenCalled()
  })

  it("suit le serveur le jour où le plafond sera relevé, sans modification du front", async () => {
    mockFetchProfileAvatarConstraints.mockResolvedValue({
      ...SERVER_CONSTRAINTS,
      maxUploadBytes: 8_000_000,
    })

    renderField({ avatarUrl: null })

    expect(await screen.findByText('Taille maximale : 8 Mo.')).toBeDefined()
  })

  it('dit quoi faire, la limite étant contraignante pour une photo de téléphone', async () => {
    renderField({ avatarUrl: null })

    expect(await screen.findByText(/réduisez-la ou recadrez-la/i)).toBeDefined()
  })

  it('annonce une limite de repli plutôt que rien quand le serveur ne répond pas', async () => {
    mockFetchProfileAvatarConstraints.mockRejectedValue({ response: { status: 500 } })
    // La panne est journalisée pour le développeur, pas affichée : on l'attend.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    renderField({ avatarUrl: null })

    // Un écran muet sur la limite serait pire : l'utilisateur découvrirait le
    // refus après l'envoi.
    expect(await screen.findByText('Taille maximale : 1 Mo.')).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
    consoleWarnSpy.mockRestore()
  })

  it("ne demande pas les contraintes à un lecteur qui ne peut pas envoyer", async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())

    renderField({ avatarUrl: AVATAR_URL, canEdit: false })

    await screen.findByRole('img', { name: /Alice Martin/ })
    expect(mockFetchProfileAvatarConstraints).not.toHaveBeenCalled()
    expect(screen.queryByText(/Taille maximale/)).toBeNull()
  })

  it('relie la limite au champ de fichier pour les lecteurs d’écran', async () => {
    renderField({ avatarUrl: null })

    await waitForConstraints()
    const fileInput = screen.getByLabelText(/photo/i)
    const hintId = fileInput.getAttribute('aria-describedby')
    expect(hintId).toBeTruthy()
    expect(document.getElementById(hintId as string)?.textContent).toContain('Taille maximale')
  })
})

describe('ProfileAvatarField — refus local avant tout envoi', () => {
  it('refuse un fichier trop lourd sans le faire partir sur le réseau', async () => {
    renderField({ avatarUrl: null })
    await waitForConstraints()

    selectFile(makePhotoFile(4_200_000))

    // Taille du fichier ET limite, toutes deux lisibles.
    const errorMessage = await screen.findByText(/pèse 4,2 Mo/)
    expect(errorMessage.textContent).toContain('maximale est de 1 Mo')
    // Rien n'est parti : inutile de faire patienter l'utilisateur.
    expect(mockUploadProfileAvatar).not.toHaveBeenCalled()
  })

  it('laisse passer un fichier sous la limite', async () => {
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: REPLACED_AVATAR_URL })
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())

    renderField({ avatarUrl: null })
    await waitForConstraints()

    selectFile(makePhotoFile(800_000))

    await waitFor(() => {
      expect(mockUploadProfileAvatar).toHaveBeenCalledWith(USER_ID, expect.any(File))
    })
    expect(screen.queryByText(/trop lourde/i)).toBeNull()
  })

  it('accepte un fichier que le serveur accepterait après relèvement du plafond', async () => {
    mockFetchProfileAvatarConstraints.mockResolvedValue({
      ...SERVER_CONSTRAINTS,
      maxUploadBytes: 8_000_000,
    })
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: REPLACED_AVATAR_URL })
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())

    renderField({ avatarUrl: null })
    await screen.findByText('Taille maximale : 8 Mo.')

    selectFile(makePhotoFile(4_200_000))

    await waitFor(() => {
      expect(mockUploadProfileAvatar).toHaveBeenCalledWith(USER_ID, expect.any(File))
    })
  })
})

describe('ProfileAvatarField — envoi', () => {
  it('envoie le fichier choisi puis affiche la NOUVELLE photo', async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: REPLACED_AVATAR_URL })

    renderField({ avatarUrl: AVATAR_URL })
    await screen.findByRole('img', { name: /Alice Martin/ })

    selectFile(makePhotoFile())

    await waitFor(() => {
      expect(mockUploadProfileAvatar).toHaveBeenCalledWith(USER_ID, expect.any(File))
    })
    // Le jeton renvoyé par le serveur est rejoué : sans lui, le navigateur
    // resservirait l'ancienne photo depuis son cache.
    await waitFor(() => {
      expect(mockFetchProfileAvatarBlob).toHaveBeenLastCalledWith(USER_ID, '1754899999999')
    })
  })

  it("révoque l'object URL de la photo remplacée", async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())
    mockUploadProfileAvatar.mockResolvedValue({ avatarUrl: REPLACED_AVATAR_URL })

    renderField({ avatarUrl: AVATAR_URL })
    const firstPhoto = await screen.findByRole('img', { name: /Alice Martin/ })
    const firstObjectUrl = firstPhoto.getAttribute('src')

    selectFile(makePhotoFile())

    await waitFor(() => {
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith(firstObjectUrl)
    })
  })

  it('parle de poids de fichier quand le serveur refuse la photo en 413', async () => {
    mockUploadProfileAvatar.mockRejectedValue({ response: { status: 413 } })

    renderField({ avatarUrl: null })
    selectFile(makePhotoFile())

    const errorMessage = await screen.findByText(/trop lourde/i)
    expect(errorMessage.textContent).toContain('1 Mo')
    expect(errorMessage.textContent).not.toContain('413')
  })

  it('exploite le corps structuré du 413 sans jamais afficher son message anglais', async () => {
    // Filet de sécurité : le contrôle local a laissé passer le fichier (taille
    // sous la limite annoncée), le serveur refuse quand même.
    mockUploadProfileAvatar.mockRejectedValue({
      response: {
        status: 413,
        data: {
          statusCode: 413,
          error: 'Payload Too Large',
          code: 'UPLOAD_FILE_TOO_LARGE',
          message: 'Uploaded file exceeds the maximum allowed size',
          maxUploadBytes: 1_000_000,
          receivedBytes: 4_500_000,
          requestBodyBytes: 4_600_000,
        },
      },
    })

    renderField({ avatarUrl: null })
    await waitForConstraints()
    selectFile(makePhotoFile(900_000))

    const errorMessage = await screen.findByText(/pèse 4,5 Mo/)
    expect(errorMessage.textContent).toContain('maximale est de 1 Mo')
    expect(errorMessage.textContent).not.toContain('Uploaded file')
  })

  it("n'annonce pas « 0 octet » quand le flux a été coupé (`receivedBytes: null`)", async () => {
    mockUploadProfileAvatar.mockRejectedValue({
      response: {
        status: 413,
        data: {
          code: 'UPLOAD_FILE_TOO_LARGE',
          maxUploadBytes: 1_000_000,
          receivedBytes: null,
          requestBodyBytes: 1_258_291,
        },
      },
    })

    renderField({ avatarUrl: null })
    await waitForConstraints()
    selectFile(makePhotoFile(900_000))

    const errorMessage = await screen.findByText(/trop lourde/i)
    expect(errorMessage.textContent).not.toContain('0 octet')
    expect(errorMessage.textContent).toContain('maximale est de 1 Mo')
  })

  it('reste compréhensible sur un 413 non-JSON renvoyé par le serveur web', async () => {
    // Si les deux plafonds divergeaient, nginx couperait le premier et
    // renverrait sa page HTML : aucune des clés attendues, et un `JSON.parse`
    // qui échoue. Le message français doit rester le même.
    mockUploadProfileAvatar.mockRejectedValue({
      response: {
        status: 413,
        data: '<html><head><title>413 Request Entity Too Large</title></head></html>',
      },
    })

    renderField({ avatarUrl: null })
    await waitForConstraints()
    selectFile(makePhotoFile(900_000))

    const errorMessage = await screen.findByText(/trop lourde/i)
    expect(errorMessage.textContent).toContain('maximale est de 1 Mo')
    expect(errorMessage.textContent).not.toContain('html')
    expect(errorMessage.textContent).not.toContain('413')
  })

  it('explique les formats acceptés quand le fichier est refusé en 400', async () => {
    mockUploadProfileAvatar.mockRejectedValue({
      response: { status: 400, data: { message: 'Unsupported image format' } },
    })

    renderField({ avatarUrl: null })
    await waitForConstraints()
    selectFile(makePhotoFile())

    // On vise la phrase du message d'erreur, pas l'encart de contraintes qui
    // énumère lui aussi les formats.
    const errorMessage = await screen.findByText(/les fichiers SVG et HEIC ne le sont pas/)
    expect(errorMessage.textContent).toContain('JPEG, PNG, WebP, GIF ou AVIF')
  })

  it("n'envoie rien quand la sélection est annulée", async () => {
    renderField({ avatarUrl: null })
    await waitForConstraints()

    const fileInput = screen.getByLabelText(/photo/i) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [] } })

    expect(mockUploadProfileAvatar).not.toHaveBeenCalled()
  })
})

describe('ProfileAvatarField — suppression', () => {
  it('supprime la photo et revient au substitut neutre', async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())
    mockDeleteProfileAvatar.mockResolvedValue(undefined)

    renderField({ avatarUrl: AVATAR_URL })
    await screen.findByRole('img', { name: /Alice Martin/ })

    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockDeleteProfileAvatar).toHaveBeenCalledWith(USER_ID)
    })
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-initials')).toBeDefined()
    })
  })

  it("révoque l'object URL de la photo supprimée", async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())
    mockDeleteProfileAvatar.mockResolvedValue(undefined)

    renderField({ avatarUrl: AVATAR_URL })
    const photo = await screen.findByRole('img', { name: /Alice Martin/ })
    const objectUrl = photo.getAttribute('src')

    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith(objectUrl)
    })
  })

  it('affiche un message quand la suppression est refusée', async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())
    mockDeleteProfileAvatar.mockRejectedValue({ response: { status: 403 } })

    renderField({ avatarUrl: AVATAR_URL })
    await screen.findByRole('img', { name: /Alice Martin/ })

    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    expect(await screen.findByText(/titulaire du profil/i)).toBeDefined()
  })
})

describe('ProfileAvatarField — fuite mémoire', () => {
  it("révoque l'object URL au démontage", async () => {
    mockFetchProfileAvatarBlob.mockResolvedValue(makePhotoBlob())

    const { unmount } = renderField({ avatarUrl: AVATAR_URL })
    const photo = await screen.findByRole('img', { name: /Alice Martin/ })
    const objectUrl = photo.getAttribute('src')

    unmount()

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith(objectUrl)
  })
})

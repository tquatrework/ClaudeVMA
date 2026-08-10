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
 *    est réutilisé, jeton `?v=` compris.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProfileAvatarField } from '../../src/components/profile/ProfileAvatarField'

vi.mock('../../src/api/profile')

import {
  deleteProfileAvatar,
  fetchProfileAvatarBlob,
  uploadProfileAvatar,
} from '../../src/api/profile'

const mockFetchProfileAvatarBlob = vi.mocked(fetchProfileAvatarBlob)
const mockUploadProfileAvatar = vi.mocked(uploadProfileAvatar)
const mockDeleteProfileAvatar = vi.mocked(deleteProfileAvatar)

const USER_ID = '464da8a2-8b4f-4cc7-b7b1-f1d0ab511355'
const AVATAR_URL = `/api/v1/profiles/${USER_ID}/avatar?v=1754820000000`
const REPLACED_AVATAR_URL = `/api/v1/profiles/${USER_ID}/avatar?v=1754899999999`

function makePhotoBlob() {
  return new Blob(['octets'], { type: 'image/webp' })
}

function makePhotoFile() {
  return new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
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

  it("n'appelle pas le serveur quand aucune photo n'est annoncée", () => {
    renderField({ avatarUrl: null })

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

  it("se replie sur « ? » quand aucun nom n'est lisible — jamais un identifiant", () => {
    renderField({ avatarUrl: null, displayName: null })

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

  it('propose « Ajouter une photo » au titulaire qui n’en a pas', () => {
    renderField({ avatarUrl: null })

    expect(screen.getByLabelText('Ajouter une photo')).toBeDefined()
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
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

  it('explique les formats acceptés quand le fichier est refusé en 400', async () => {
    mockUploadProfileAvatar.mockRejectedValue({
      response: { status: 400, data: { message: 'Unsupported image format' } },
    })

    renderField({ avatarUrl: null })
    selectFile(makePhotoFile())

    expect(await screen.findByText(/JPEG, PNG, WebP, GIF ou AVIF/)).toBeDefined()
  })

  it("n'envoie rien quand la sélection est annulée", () => {
    renderField({ avatarUrl: null })

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

/**
 * Tests de PrescriptionPanel — lecture de la section prescription.
 *
 * C'est le pendant lecture de `PUT /profiles/:userId/prescription` : le titulaire
 * **lit** ce que le responsable pédagogique a écrit sur lui, sans jamais pouvoir
 * le modifier. Deux exigences y sont vérifiées :
 *
 * - la prescription est **attribuée et datée** — `filledBy` / `filledAt` sont ce
 *   qui la rend opposable, les masquer reviendrait à présenter un avis anonyme ;
 * - `filledBy` est un identifiant technique : il n'est **jamais** affiché tel
 *   quel (règle UX du projet), mais résolu en « Prénom Nom » via
 *   `GET /profiles/:id`, avec repli sur le libellé du rôle si la lecture est
 *   refusée.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrescriptionPanel } from '../../../src/components/profile/PrescriptionPanel'

vi.mock('../../../src/api/profile')

import { fetchProfile } from '../../../src/api/profile'

const mockFetchProfile = vi.mocked(fetchProfile)

const STUDENT_PEDAGOGICAL = {
  level: 'Terminale',
  difficulties: 'Les fonctions dérivées',
  generalAssessment: 'Élève sérieuse et régulière',
  recommendedPace: 'Deux séances hebdomadaires',
  recommendedTeacherProfile: 'Formateur habitué à la remise en confiance',
  recommendedPath: 'Remise à niveau puis préparation au bac',
  recommendedActivities: 'Exercices guidés hebdomadaires',
  filledBy: '8f2c1d9e-0000-4000-8000-000000000001',
  filledAt: '2026-08-09T10:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchProfile.mockResolvedValue({
    userId: '8f2c1d9e-0000-4000-8000-000000000001',
    administrative: { firstName: 'Claire', lastName: 'Dubois' },
    pedagogical: null,
    pedagogicalType: null,
  })
})

describe('PrescriptionPanel', () => {
  it('affiche les préconisations avec leurs libellés français', async () => {
    render(<PrescriptionPanel pedagogicalType="student" pedagogical={STUDENT_PEDAGOGICAL} />)

    expect(screen.getByText('Type de formateur préconisé')).toBeDefined()
    expect(screen.getByText('Formateur habitué à la remise en confiance')).toBeDefined()
    expect(screen.getByText('Considération générale')).toBeDefined()
    expect(screen.getByText('Rythme préconisé')).toBeDefined()
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled())
  })

  it("n'affiche aucun champ déclaratif : ce bloc n'est pas le propos du titulaire", async () => {
    render(<PrescriptionPanel pedagogicalType="student" pedagogical={STUDENT_PEDAGOGICAL} />)

    expect(screen.queryByText('Niveau scolaire')).toBeNull()
    expect(screen.queryByText('Difficultés rencontrées')).toBeNull()
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled())
  })

  it('attribue et date la prescription, sans jamais montrer l’UUID de l’auteur', async () => {
    render(<PrescriptionPanel pedagogicalType="student" pedagogical={STUDENT_PEDAGOGICAL} />)

    await waitFor(() => {
      expect(screen.getByText('Claire Dubois')).toBeDefined()
    })
    expect(screen.getByText(/mis à jour le 09\/08\/2026/)).toBeDefined()
    expect(
      screen.queryByText(/8f2c1d9e-0000-4000-8000-000000000001/),
    ).toBeNull()
    expect(mockFetchProfile).toHaveBeenCalledWith('8f2c1d9e-0000-4000-8000-000000000001')
  })

  it("retombe sur le libellé du rôle quand le profil de l'auteur est illisible", async () => {
    // Un élève n'a pas forcément le droit de lire le profil du RP qui l'a suivi :
    // ce n'est pas une erreur à lui montrer, mais ce n'est pas une raison pour
    // afficher un identifiant technique.
    mockFetchProfile.mockRejectedValue({ response: { status: 403, data: {} } })

    render(<PrescriptionPanel pedagogicalType="student" pedagogical={STUDENT_PEDAGOGICAL} />)

    await waitFor(() => {
      expect(screen.getByText('Responsable pédagogique')).toBeDefined()
    })
    expect(screen.queryByText(/8f2c1d9e/)).toBeNull()
  })

  it('rappelle explicitement que la modification ne relève pas du titulaire', async () => {
    render(<PrescriptionPanel pedagogicalType="student" pedagogical={STUDENT_PEDAGOGICAL} />)

    expect(screen.getByText(/leur modification lui appartient/i)).toBeDefined()
    // Un bloc de lecture, jamais un formulaire désactivé.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled())
  })

  it('affiche la prescription formateur, résultats de tests compris', async () => {
    render(
      <PrescriptionPanel
        pedagogicalType="teacher"
        pedagogical={{
          experience: '8 ans en lycée',
          maxValidatedLevel: 'Terminale spécialité mathématiques',
          audienceType: 'Collège et lycée',
          testResults: 'Test interne validé',
          testComments: 'Très bonne maîtrise disciplinaire',
        }}
      />,
    )

    expect(screen.getByText('Niveau maximum validé')).toBeDefined()
    expect(screen.getByText('Résultats des tests')).toBeDefined()
    expect(screen.getByText('Commentaires sur les tests')).toBeDefined()
    // `experience` est déclaratif : il n'a rien à faire dans ce bloc.
    expect(screen.queryByText('Expérience pédagogique')).toBeNull()
    // Aucun auteur connu : aucune requête d'enrichissement inutile.
    expect(mockFetchProfile).not.toHaveBeenCalled()
  })

  it('dit clairement qu’aucune prescription n’a encore été rédigée', () => {
    render(<PrescriptionPanel pedagogicalType="student" pedagogical={{ level: 'Terminale' }} />)

    expect(
      screen.getByText(
        "Aucune prescription n'a encore été rédigée par le responsable pédagogique.",
      ),
    ).toBeDefined()
    expect(mockFetchProfile).not.toHaveBeenCalled()
  })

  it('tolère un profil pédagogique absent, état normal', () => {
    render(<PrescriptionPanel pedagogicalType="student" pedagogical={null} />)

    expect(screen.getByText(/Aucune prescription/)).toBeDefined()
  })

  /**
   * Tous les champs de prescription sont `self` par défaut : un formateur
   * rattaché les reçoit donc masqués en bloc. Sans distinction, ce panneau
   * annonçait « Aucune prescription n'a encore été rédigée » — un mensonge, le
   * serveur ne masquant que ce qui est réglé, jamais ce qui est vide.
   */
  describe('lecture filtrée', () => {
    const HIDDEN_PRESCRIPTION = {
      isFiltered: true,
      hiddenFields: [
        'generalAssessment',
        'recommendedPace',
        'recommendedTeacherProfile',
        'recommendedPath',
        'recommendedActivities',
      ],
    }

    it('ne prétend pas qu’aucune prescription n’a été rédigée quand tout est masqué', () => {
      render(
        <PrescriptionPanel
          pedagogicalType="student"
          pedagogical={{ level: 'Terminale' }}
          visibility={HIDDEN_PRESCRIPTION}
        />,
      )

      expect(screen.queryByText(/Aucune prescription/)).toBeNull()
      expect(
        screen.getByText(
          'Les préconisations du responsable pédagogique ne vous sont pas communiquées.',
        ),
      ).toBeDefined()
    })

    it('liste chaque champ masqué avec sa mention « Non partagé »', () => {
      render(
        <PrescriptionPanel
          pedagogicalType="student"
          pedagogical={{ level: 'Terminale' }}
          visibility={HIDDEN_PRESCRIPTION}
        />,
      )

      expect(screen.getByText('Considération générale')).toBeDefined()
      expect(screen.getAllByText('Non partagé')).toHaveLength(5)
    })

    it('mélange sans ambiguïté champs visibles et champs masqués', () => {
      render(
        <PrescriptionPanel
          pedagogicalType="student"
          pedagogical={{ generalAssessment: 'Élève sérieuse', recommendedPace: null }}
          visibility={{ isFiltered: true, hiddenFields: ['recommendedPath'] }}
        />,
      )

      // Visible : sa valeur.
      expect(screen.getByText('Élève sérieuse')).toBeDefined()
      // Présent à `null` : non renseigné, donc pas listé.
      expect(screen.queryByText('Rythme préconisé')).toBeNull()
      // Absent et déclaré masqué : listé, avec la mention.
      expect(screen.getByText('Parcours préconisé')).toBeDefined()
      expect(screen.getAllByText('Non partagé')).toHaveLength(1)
      // Le message global ne s'affiche que si rien n'est visible.
      expect(screen.queryByText(/ne vous sont pas communiquées/)).toBeNull()
    })

    it('reste inchangé pour une lecture non filtrée', () => {
      render(
        <PrescriptionPanel
          pedagogicalType="student"
          pedagogical={{ level: 'Terminale' }}
          visibility={{ isFiltered: false, hiddenFields: [] }}
        />,
      )

      expect(screen.getByText(/Aucune prescription/)).toBeDefined()
      expect(screen.queryByText('Non partagé')).toBeNull()
    })
  })
})

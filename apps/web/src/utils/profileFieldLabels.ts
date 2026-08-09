/**
 * Libellés français des champs de profil — **point unique** de la correspondance
 * nom technique (anglais, aligné front/back) → libellé affiché (français).
 *
 * Règle du projet (`docs/architecture.md` § « Langue de l'application »,
 * 2026-08-09) : les noms de champs, de variables et de clés d'API sont en
 * anglais ; tout ce que l'utilisateur lit est en français. La correspondance
 * vit ici et nulle part ailleurs — un libellé recopié dans un composant finit
 * par diverger d'un écran à l'autre.
 *
 * Tout écran affichant un champ de profil (fiche, formulaires, écran de
 * visibilité) lit cette table. Aucun composant ne redéclare de libellé.
 */

/**
 * Catalogue complet : profils administratif et pédagogique (sections
 * déclarative et prescription), plus les champs de traçabilité.
 *
 * Les clés reprennent exactement les noms de `docs/routes.md` § « Noms de champs
 * des profils » et le catalogue de visibilité (34 champs).
 */
export const PROFILE_FIELD_LABELS: Record<string, string> = {
  // ─── Profil administratif ───────────────────────────────────────────────────
  firstName: 'Prénom',
  lastName: 'Nom',
  birthDate: 'Date de naissance',
  phone: 'Téléphone',
  addressLine1: 'Adresse (ligne 1)',
  addressLine2: 'Adresse (ligne 2)',
  postalCode: 'Code postal',
  city: 'Ville',
  country: 'Pays',
  department: 'Département',
  avatarUrl: 'Photo de profil',
  passions: "Centres d'intérêt",

  // ─── Pédagogique élève — section déclarative ───────────────────────────────
  level: 'Niveau scolaire',
  subjects: 'Matières',
  goals: 'Objectifs pédagogiques',
  specificNeeds: 'Besoins spécifiques (aménagements)',
  difficulties: 'Difficultés rencontrées',
  context: 'Contexte scolaire et familial',

  // ─── Pédagogique élève — section prescription (RP) ─────────────────────────
  generalAssessment: 'Considération générale',
  recommendedPace: 'Rythme préconisé',
  recommendedTeacherProfile: 'Type de formateur préconisé',
  recommendedPath: 'Parcours préconisé',
  recommendedActivities: 'Activités préconisées',

  // ─── Pédagogique formateur — section déclarative ───────────────────────────
  levels: 'Niveaux enseignés',
  experience: 'Expérience pédagogique',
  diplomas: 'Diplômes et certifications',
  specialties: "Spécialités d'accompagnement",
  particularities: 'Particularités et modalités',
  cvDocumentId: 'CV (référence du document)',

  // ─── Pédagogique formateur — section prescription (RP) ─────────────────────
  maxValidatedLevel: 'Niveau maximum validé',
  audienceType: 'Type de public habilité',
  testResults: 'Résultats des tests',
  testComments: 'Commentaires sur les tests',

  // ─── Champs annexes ────────────────────────────────────────────────────────
  comments: 'Commentaires',
  isAnimateurPedagogique: 'Animateur pédagogique',
  filledBy: 'Rempli par',
  filledAt: 'Rempli le',
  loginIdentifier: 'Identifiant de connexion',

  // ─── Traçabilité posée par le serveur (lecture seule) ──────────────────────
  createdAt: 'Profil créé le',
  updatedAt: 'Dernière modification',
}

/**
 * Précisions affichées sous certains champs. Facultatives : un champ sans
 * précision n'en affiche aucune, plutôt qu'un texte de remplissage.
 */
export const PROFILE_FIELD_HINTS: Record<string, string> = {
  difficulties:
    "Ce sur quoi vous butez au quotidien — distinct d'un aménagement reconnu",
  specificNeeds: 'Aménagements reconnus : DYS, PAP, PPS…',
  context: 'Situation scolaire et familiale utile au suivi',
  specialties: "Type d'accompagnement, distinct de la matière",
  cvDocumentId: 'Référence du CV déposé dans les archives documentaires',
  particularities: 'Modalités, contraintes, publics particuliers',
}

/**
 * Libellé français d'un champ.
 *
 * Le repli — découpage du camelCase — ne concerne qu'un champ que le serveur
 * ajouterait sans que le front soit à jour. **Il produit de l'anglais** (`userId`
 * → « User id ») : atteindre ce repli sur un champ affiché est un défaut, pas un
 * comportement acceptable. C'est ce qui avait laissé « User id », « Created at »
 * et « Updated at » à l'écran sur le profil administratif. Le test
 * `profileFieldLabels.test.ts` vérifie que tout champ affichable est présent
 * ci-dessus, donc qu'aucun n'y retombe.
 */
export function getProfileFieldLabel(fieldName: string): string {
  const knownLabel = PROFILE_FIELD_LABELS[fieldName]
  if (knownLabel) return knownLabel

  const spaced = fieldName.replace(/([A-Z])/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/** Précision associée à un champ, ou `undefined` s'il n'en a pas. */
export function getProfileFieldHint(fieldName: string): string | undefined {
  return PROFILE_FIELD_HINTS[fieldName]
}

// ─── Écran de visibilité ──────────────────────────────────────────────────────

/** Intitulé de section pour chaque bloc renvoyé par `field-visibility`. */
export const FIELD_VISIBILITY_BLOCK_LABELS: Record<string, string> = {
  administrative: 'Informations administratives',
  'pedagogical-student': 'Profil pédagogique — élève',
  'pedagogical-teacher': 'Profil pédagogique — formateur',
}

export function getFieldVisibilityBlockLabel(block: string): string {
  return FIELD_VISIBILITY_BLOCK_LABELS[block] ?? 'Autres informations'
}

/** Libellé court de chaque public, tel qu'affiché sur les boutons de choix. */
export const FIELD_VISIBILITY_AUDIENCE_LABELS: Record<string, string> = {
  self: 'Moi seul',
  linked: 'Mes contacts liés',
  all: 'Tous les membres',
}

/** Explication affichée sous le choix, pour que la portée soit sans ambiguïté. */
export const FIELD_VISIBILITY_AUDIENCE_DESCRIPTIONS: Record<string, string> = {
  self: "Visible par vous seul et par l'administration de la plateforme",
  linked: 'Visible aussi par vos contacts (parents, formateurs, responsable pédagogique)',
  all: 'Visible par tous les membres connectés de la plateforme',
}

export function getFieldVisibilityAudienceLabel(audience: string): string {
  return FIELD_VISIBILITY_AUDIENCE_LABELS[audience] ?? audience
}

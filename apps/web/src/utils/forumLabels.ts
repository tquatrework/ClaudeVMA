/**
 * Libellés français des Forums — point unique, sur le modèle des autres fichiers de libellés du
 * projet (`teacherRequestLabels.ts`, `pedagogicalLogLabels.ts`…).
 */

import { formatFileSize } from './fileSize'
import { formatAcceptedImageFormats } from './profileAvatar'
import { getRoleLabel } from './role'
import type { ForumRestrictableRole, ForumTopicStatus } from '../types/forum'

export const FORUM_LABELS = {
  emptyList: 'Aucun forum disponible pour le moment.',
  loadError: 'Impossible de charger les forums.',
  notFound: "Ce forum n'existe pas ou n'est plus accessible.",
  createButton: 'Créer un forum',
  createTitle: 'Créer un forum',
  createHelp: 'Le forum est visible immédiatement, sans étape de validation.',
  openToEveryone: 'Ouvert à tous les comptes connectés.',
  restrictedTo: 'Réservé à :',
  emptyComments: 'Aucun commentaire pour l’instant. Soyez le premier à contribuer !',
  loadCommentsError: 'Impossible de charger les commentaires.',
  postCommentError: 'Impossible d’envoyer le commentaire.',
  excludedError: 'Vous avez été exclu de ce forum.',
  deleteComment: 'Supprimer',
  deleteCommentConfirm: 'Supprimer ce commentaire ? Cette action est définitive.',
  deleteCommentError: 'Impossible de supprimer ce commentaire.',
  charterRequiredBanner: 'Vous devez accepter la charte de bonne conduite avant de participer à un forum.',
  charterReadLink: 'Lire la charte de bonne conduite',
  charterAccept: 'J’accepte la charte',
  charterAccepting: 'Validation…',
  charterAcceptedAt: 'Charte acceptée le',
  charterEmptyPlaceholder:
    "La charte de bonne conduite n'a pas encore été rédigée par un responsable pédagogique.",
  imageAlt: "Illustration du forum",
  addImage: 'Ajouter une image',
  replaceImage: "Remplacer l'image",
  uploadingImage: 'Envoi…',
  imageUploadError: "Impossible d'envoyer l'image.",
  hideForum: 'Cacher le forum',
  hidingForum: 'Masquage…',
  hideForumConfirm:
    "Cacher ce forum ? Il ne sera plus visible par personne, sauf vous en tant que responsable pédagogique. Cette action ne peut pas être annulée depuis l'application.",
  hideForumError: 'Impossible de cacher ce forum.',
  hiddenBadge: 'Caché',
  hiddenNotice: "Ce forum est caché : il n'est visible que par vous.",
  allForumsTab: 'Tous les forums',
  myForumsTab: 'Mes forums',
  emptyMine: "Vous n'avez créé aucun forum pour le moment.",
  editForum: 'Modifier le forum',
  editTitle: 'Modifier le forum',
  editHelp: 'Seuls les champs modifiés sont pris en compte.',
  saveChanges: 'Enregistrer les modifications',
  saving: 'Enregistrement…',
  updateForumError: 'Impossible de modifier ce forum.',

  // ─── Sujets (topics), ajoutés le 2026-09-04 ───────────────────────────────
  topicsTitle: 'Sujets',
  newTopicButton: 'Nouveau sujet',
  newTopicTitle: 'Créer un nouveau sujet',
  topicTitleLabel: 'Titre du sujet',
  topicFirstMessageLabel: 'Votre premier message',
  createTopicSubmit: 'Publier le sujet',
  creatingTopic: 'Publication…',
  createTopicError: 'Impossible de créer ce sujet.',
  emptyTopics: 'Aucun sujet pour le moment. Soyez le premier à en créer un !',
  loadTopicsError: 'Impossible de charger les sujets.',
  loadTopicError: 'Impossible de charger ce sujet.',
  notFoundTopic: "Ce sujet n'existe pas ou n'est plus accessible.",
  topicStatusPending: 'En attente de validation',
  topicStatusRejected: 'Refusé',
  validateTopic: 'Valider le sujet',
  rejectTopic: 'Refuser le sujet',
  validatingTopic: 'Validation…',
  rejectingTopic: 'Refus…',
  decideTopicError: 'Impossible de traiter ce sujet.',
  pendingTopicsModerationTitle: 'Sujets en attente de validation',
  emptyPendingTopics: 'Aucun sujet en attente de validation.',
  backToTopics: '← Retour aux sujets',
} as const

/** « Taille maximale : 1 Mo. » — la valeur vient toujours du serveur. */
export function getForumImageMaxSizeHint(maxSizeBytes: number): string {
  return `Taille maximale : ${formatFileSize(maxSizeBytes) ?? ''}.`
}

/** « Formats acceptés : JPEG, PNG, WebP ou GIF. » */
export function getForumImageFormatsHint(allowedMimeTypes: readonly string[]): string {
  return `Formats acceptés : ${formatAcceptedImageFormats(allowedMimeTypes)}.`
}

/** Énumération française des rôles autorisés : « Élèves, Formateurs ». */
export function formatAllowedRolesLabel(allowedRoles: ForumRestrictableRole[] | null): string {
  if (!allowedRoles || allowedRoles.length === 0) return FORUM_LABELS.openToEveryone
  return allowedRoles.map((role) => getRoleLabel(role)).join(', ')
}

/** Libellé français d'un statut de sujet — `null` pour `validated`, qui ne porte aucun badge (un
 * sujet validé est affiché comme un sujet normal, jamais annoté). */
export function formatTopicStatusLabel(status: ForumTopicStatus): string | null {
  if (status === 'pending_validation') return FORUM_LABELS.topicStatusPending
  if (status === 'rejected') return FORUM_LABELS.topicStatusRejected
  return null
}

/**
 * Types d'éléments pouvant figurer dans les archives pédagogiques.
 * Correspond aux fonctionnalités 001–006 de la spec XML.
 */
export enum ArchiveItemType {
  /** Entrée du cahier de texte (pedagogical-log-service) */
  CAHIER_DE_TEXTE = 'cahier_de_texte',
  /** Carnet personnel de l'élève (réservé à l'élève, non exposé aux parents) */
  CARNET_PERSONNEL = 'carnet_personnel',
  /** Résumé de cours issu d'une visio (durable même après expiration de la vidéo) */
  RESUME_DE_COURS = 'resume_de_cours',
  /** Contenu chargé par l'élève avec score */
  CONTENU_ELEVE = 'contenu_eleve',
  /** Parcours pédagogique fini ou en cours */
  PARCOURS = 'parcours',
  /** Exercice ou évaluation commenté/noté/répondu */
  EXERCICE_EVALUATION = 'exercice_evaluation',
  /** Vidéo vue, commentée ou notée */
  VIDEO = 'video',
}

/**
 * Types d'événements émis par ce module sur le flux Redis
 * `visiomath:events`, à consommer par dashboard-notification-service — même
 * convention que teacher-request-service (`type` technique, libellé
 * français composé côté front en un point unique, docs/architecture.md >
 * « Systeme de notifications transversal », point 3).
 *
 * Destinataires prévus par événement (résolus par dashboard-notification-service,
 * jamais par ce service ni par le front — voir rapport de chantier pour le
 * détail complet à l'attention de la délégation dashboard-notification-service) :
 *
 *   - EvaluationCorrectionRequested → chaque professeur de `teacherIds`
 *     (notification individuelle) + rôle RP.
 *   - EvaluationCorrectionAccepted  → rôle RP.
 *   - EvaluationCorrectionDeclined  → rôle RP.
 *   - EvaluationCorrectionAllDeclined → rôle RP (état terminal actionnable :
 *     doit être visible dans la file RP, cf. GET /evaluation-corrections/pending).
 *   - EvaluationCorrected           → l'élève (studentId).
 */
export const EVALUATION_CORRECTION_REQUESTED = 'EvaluationCorrectionRequested';
export const EVALUATION_CORRECTION_ACCEPTED = 'EvaluationCorrectionAccepted';
export const EVALUATION_CORRECTION_DECLINED = 'EvaluationCorrectionDeclined';
export const EVALUATION_CORRECTION_ALL_DECLINED = 'EvaluationCorrectionAllDeclined';
export const EVALUATION_CORRECTED = 'EvaluationCorrected';

/**
 * Machine à états d'une demande de correction d'Évaluation
 * (docs/architecture.md > « Refonte des Evaluations », point 4) :
 *
 *   PENDING ──accept(formateur lié)──> ACCEPTED ──correct()──> CORRECTED
 *      │                                  ▲
 *      │ decline(dernier formateur lié)   │ accept(RP, override d'escalade)
 *      ▼                                  │
 *   ALL_DECLINED ──────────────────────────┘
 *
 *   - PENDING      : demande créée, en attente qu'un professeur lié à l'élève
 *                    accepte.
 *   - ACCEPTED     : un professeur (premier arrivé, premier servi) ou le RP
 *                    (override d'escalade depuis ALL_DECLINED) a pris en
 *                    charge la correction.
 *   - CORRECTED    : le correcteur a soumis son évaluation (score et/ou
 *                    commentaire).
 *   - ALL_DECLINED : tous les professeurs liés à l'élève au moment du calcul
 *                    ont refusé — état terminal qui notifie le RP pour qu'il
 *                    gère manuellement (corriger lui-même via le même
 *                    override d'acceptation, ou réassigner hors application).
 */
export enum EvaluationCorrectionStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  CORRECTED = 'corrected',
  ALL_DECLINED = 'all_declined',
}

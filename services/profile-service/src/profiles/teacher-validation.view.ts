import { TeacherValidation } from './entities/teacher-validation.entity';

/**
 * Forme EXPOSÉE d'un enregistrement de validation formateur.
 *
 * Liste blanche assumée (même convention que `administrative-profile.view.ts`),
 * pas un `...validation` : elle garde les noms de champs EXISTANTS à l'identique
 * (`id`, `teacherId`, `status`, `comment`, `validatedBy`, `validatorRole`,
 * `createdAt`, `updatedAt`) — arbitrage du 2026-08-13, « Reprise de candidature
 * après un refus formateur » : `GET /profiles/:teacherId/validation` doit
 * continuer à répondre sous la même forme qu'avant la journalisation
 * append-only.
 *
 * Le seul ajout est `reapplyEligibleAt`, et STRICTEMENT quand `status ===
 * 'rejected'` : c'est une échéance de reprise, elle n'a aucun sens pour un
 * dossier `pending`, `in_review` ou `validated`. Un champ `undefined` est omis
 * par la sérialisation JSON par défaut de Nest — il n'apparaît donc pas du
 * tout dans les autres cas, plutôt que d'apparaître à `null`.
 */
export interface TeacherValidationView {
  id: string;
  teacherId: string;
  status: TeacherValidation['status'];
  validatedBy: string | null;
  validatorRole: TeacherValidation['validatorRole'] | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  reapplyEligibleAt?: Date;
}

/**
 * Échéance de reprise de candidature après un refus formateur (arbitrage du
 * 2026-08-13, docs/architecture.md > « Reprise de candidature après un refus
 * formateur », point 1).
 *
 * ANNÉE SCOLAIRE : du 1er août (inclus) de l'année N au 31 juillet (inclus) de
 * l'année N+1 — première notion d'année scolaire du projet, propre à cette
 * règle.
 *
 * Un refus survenu en août à décembre de l'année N appartient à l'année
 * scolaire [1er août N, 31 juillet N+1] : la reprise devient possible au 1er
 * août SUIVANT, soit N+1.
 * Un refus survenu en janvier à juillet de l'année N appartient à l'année
 * scolaire PRÉCÉDENTE [1er août N-1, 31 juillet N] : la reprise devient
 * possible au 1er août de la même année N.
 *
 * Calcul entièrement en UTC : `reapplyEligibleAt` désigne un jour calendaire
 * (le 1er août), pas un instant précis — le faire dépendre du fuseau horaire
 * du serveur ferait varier le résultat sans aucune raison métier.
 */
export function computeReapplyEligibleAt(rejectedAt: Date): Date {
  const rejectionMonth = rejectedAt.getUTCMonth() + 1; // 1 (janvier) à 12 (décembre)
  const rejectionYear = rejectedAt.getUTCFullYear();
  const eligibleYear = rejectionMonth >= 8 ? rejectionYear + 1 : rejectionYear;
  return new Date(Date.UTC(eligibleYear, 7, 1)); // 7 = août, mois 0-indexé
}

/**
 * Formatage français jj/mm/aaaa, pour les messages de refus cités dans
 * `docs/architecture.md` (règle du 2026-08-09 : tout ce que l'utilisateur lit
 * est en français). `reapplyEligibleAt` étant toujours un 1er août à minuit
 * UTC, ce formatage reste exact quel que soit le fuseau du lecteur.
 */
export function formatFrenchDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Projette l'entité vers sa forme exposée, en ajoutant `reapplyEligibleAt`
 * quand (et seulement quand) le statut courant est `rejected`.
 *
 * Point de passage OBLIGÉ de toute réponse portant un enregistrement de
 * validation (`GET`/`PATCH`/`POST .../reapply`) : c'est lui qui décide si
 * l'échéance de reprise doit apparaître, une seule fois pour les trois routes.
 */
export function toTeacherValidationView(validation: TeacherValidation): TeacherValidationView {
  const base: TeacherValidationView = {
    id: validation.id,
    teacherId: validation.teacherId,
    status: validation.status,
    validatedBy: validation.validatedBy ?? null,
    validatorRole: validation.validatorRole ?? null,
    comment: validation.comment ?? null,
    createdAt: validation.createdAt,
    updatedAt: validation.updatedAt,
  };

  if (validation.status !== 'rejected') {
    return base;
  }

  return {
    ...base,
    reapplyEligibleAt: computeReapplyEligibleAt(validation.createdAt),
  };
}

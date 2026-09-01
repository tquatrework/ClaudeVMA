import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentStatus } from '../../common/enums/content-status.enum';

/**
 * Evaluation — cycle de vie aligné sur Quizz/Exercice (arbitrage du
 * 2026-09-01, docs/architecture.md, "Refonte des Evaluations : notation
 * manuelle, demande de correction, notifications"). Une évaluation reste une
 * liste ordonnée d'Exercices existants (`exerciseItems`) — cette structure ne
 * change pas dans ce chantier, seul son cycle de vie et deux colonnes sont
 * touchés :
 *
 *   - `status` : fixé à la création selon le rôle par `EvaluationsService`
 *     (pending_validation pour un formateur, validated pour AP/RP), comme
 *     Quiz/Exercise depuis fin août — le défaut `DRAFT` ci-dessous n'est
 *     qu'une valeur de repli au niveau colonne, jamais utilisée en pratique
 *     puisque le service fixe toujours explicitement le statut.
 *   - `tags` : colonne `text[]` postgres native (et non `simple-array`),
 *     même choix que `Quiz`/`Exercise` — permet une recherche exacte par tag
 *     via `ANY(tags)`, sans faux positif de sous-chaîne. Convertie depuis
 *     `simple-array` par la migration `ConvertEvaluationTagsToNativeArray`.
 *   - `durationSeconds` : devient obligatoire (arbitrage du 2026-09-01, point
 *     7, "duree obligatoire — confirmé") — colonne rendue NOT NULL par la
 *     migration `MakeEvaluationDurationRequired`.
 *
 * `EvaluationAttempt` (tentative/réponses/score) est retirée de ce service :
 * elle migre vers `learning-activity-service`, sur le même modèle que Quiz
 * et Exercise (delegation séparée, en cours en parallèle) — voir la
 * migration `DropEvaluationAttempts`.
 */
@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  exerciseItems: EvaluationExerciseItem[];

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  difficulty: string;

  @Column({ nullable: true })
  theme: string;

  @Column({ type: 'simple-array', nullable: true })
  competencies: string[];

  @Column('text', { array: true, nullable: true })
  tags: string[];

  @Column()
  durationSeconds: number;

  @Column({ default: false })
  blockBackNavigation: boolean;

  @Column()
  authorId: string;

  @Column()
  authorRole: string;

  @Column({
    type: 'enum',
    enum: ContentStatus,
    default: ContentStatus.DRAFT,
  })
  status: ContentStatus;

  @Column({ nullable: true })
  shareableLink: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface EvaluationExerciseItem {
  exerciseId: string;
  titleOverride?: string;
  order: number;
}

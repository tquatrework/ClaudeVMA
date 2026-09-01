import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EvaluationAttemptStatus } from '../../common/enums/evaluation-attempt-status.enum';

/**
 * Item de réponse — même mécanisme texte/formule/image que le Memo et
 * l'Exercice (docs/architecture.md > « Refonte des Exercices », point 2).
 * Forme propre à ce service : jamais lue par content-catalog-service.
 */
export interface EvaluationAnswerItem {
  type: 'text' | 'formula' | 'image';
  content: string;
}

/**
 * Une réponse porte sur un bloc question d'un des Exercices qui composent
 * l'Évaluation (exerciseId + partId, tous deux définis par
 * content-catalog-service) — une Évaluation n'a pas ses propres questions,
 * elle référence des Exercices existants (docs/architecture.md > « Refonte
 * des Evaluations », point 2 : « exerciseItems... pas ses propres
 * questions »).
 */
export interface EvaluationAnswerEntry {
  exerciseId: string;
  partId: string;
  content: EvaluationAnswerItem[];
  answeredAt: string;
}

/**
 * Agrège tout le cycle de vie d'une tentative d'Évaluation pour un
 * utilisateur : démarrage chronométré (deadlineAt calculé à partir de
 * durationSeconds lu sur l'Évaluation), réponses par bloc question
 * (verrouillées après l'échéance), clôture, et demande de correction
 * (entité séparée EvaluationCorrectionRequest, une tentative peut porter au
 * plus une demande active à la fois — voir EvaluationAttemptsService).
 */
@Entity('evaluation_attempts')
export class EvaluationAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  evaluationId: string;

  @Column()
  userId: string;

  @Column()
  userRole: string;

  @Column({
    type: 'enum',
    enum: EvaluationAttemptStatus,
    default: EvaluationAttemptStatus.IN_PROGRESS,
  })
  status: EvaluationAttemptStatus;

  /**
   * Identifiants des Exercices composant l'Évaluation au moment du
   * démarrage (snapshot lu une seule fois via GET /evaluations/:id) — sert
   * uniquement à valider qu'une réponse soumise porte bien sur un Exercice
   * de cette Évaluation, sans avoir à rappeler content-catalog-service à
   * chaque soumission de réponse.
   */
  @Column({ type: 'jsonb' })
  exerciseIds: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  answers: EvaluationAnswerEntry[];

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamptz' })
  deadlineAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

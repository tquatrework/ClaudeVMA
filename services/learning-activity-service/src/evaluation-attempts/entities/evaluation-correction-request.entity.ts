import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EvaluationCorrectionStatus } from '../../common/enums/evaluation-correction-status.enum';

/**
 * Demande de correction humaine d'une tentative d'Évaluation
 * (docs/architecture.md > « Refonte des Evaluations », point 4). La
 * correction ne compare jamais à la solution officielle de l'Exercice — le
 * professeur qui corrige lit uniquement la réponse soumise par l'élève sur
 * la tentative visée (point 6 de l'arbitrage : « une correction n'a rien à
 * voir avec une solution »). Aucune notion de professeur principal
 * n'existant dans ce projet, `linkedTeacherIds` est le figé (snapshot) des
 * professeurs liés à l'élève au moment de la création de la demande — sert à
 * la liste "file d'attente" du professeur sans requête répétée vers
 * profile-service ; l'autorisation d'agir (accept/decline) est, elle,
 * revérifiée en direct auprès de profile-service à chaque action (jamais en
 * cache, même principe que partout ailleurs dans ce projet).
 */
@Entity('evaluation_correction_requests')
export class EvaluationCorrectionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  attemptId: string;

  @Column()
  evaluationId: string;

  @Index()
  @Column()
  studentId: string;

  @Column({
    type: 'enum',
    enum: EvaluationCorrectionStatus,
    default: EvaluationCorrectionStatus.PENDING,
  })
  status: EvaluationCorrectionStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  linkedTeacherIds: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  declinedByTeacherIds: string[];

  @Column({ nullable: true })
  acceptedByTeacherId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  score: number | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  correctedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

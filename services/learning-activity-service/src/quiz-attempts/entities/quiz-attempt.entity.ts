import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuizAttemptStatus } from '../../common/enums/quiz-attempt-status.enum';

/**
 * Détail de notation pour une question, tel que renvoyé par
 * content-catalog-service (POST /internal/quizzes/:quizId/grade).
 * Ne contient jamais la solution en clair — uniquement correct/incorrect et points.
 */
export interface QuizAttemptQuestionResult {
  questionId: string;
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
}

/**
 * Agrège tout le cycle de vie d'une tentative de Quizz pour un utilisateur :
 * démarrage (inscription), passage (réponses soumises via submit) et résultat
 * (score, détail par question) exploité pour l'historique.
 */
@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  quizId: string;

  @Column()
  userId: string;

  @Column()
  userRole: string;

  @Column({
    type: 'enum',
    enum: QuizAttemptStatus,
    default: QuizAttemptStatus.IN_PROGRESS,
  })
  status: QuizAttemptStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  score: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  details: QuizAttemptQuestionResult[] | null;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { QuizQuestion } from './quiz-question.entity';

/**
 * Index UNIQUE `(authorId, title)` posé par la migration
 * `AddExerciseQuizTitleUniqueConstraint1795000000000` (docs/architecture.md,
 * "Titre des Exercices et des Quizz : disambiguation automatique plutôt que
 * refus", point 3) — ferme la fenêtre de compétition (TOCTOU) entre la
 * vérification applicative (`QuizzesService.resolveUniqueTitle`) et
 * l'écriture. Pas de filtre partiel ici (contrairement à `Exercise`) : le
 * Quizz n'a pas de statut `REMOVED` dans son cycle de vie actuel (pas de
 * route de retrait). Le retry applicatif sur violation `23505` de CET index
 * précis vit dans `QuizzesService` (`isPostgresUniqueViolation`,
 * `src/common/utils/postgres-errors.ts`).
 */
@Entity('quizzes')
@Index('IDX_quiz_author_title_unique', ['authorId', 'title'], { unique: true })
export class Quiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  /**
   * Colonne postgres `text[]` native (et non `simple-array`) pour permettre
   * une recherche par tag exacte (`:tag = ANY(tags)`), sans faux positifs
   * de sous-chaîne.
   */
  @Column('text', { array: true, nullable: true })
  tags: string[];

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

  /** Barème global par défaut : points attribués à une question qui ne fixe pas son propre barème. */
  @Column({ type: 'float', default: 1 })
  defaultPoints: number;

  /** Pénalité activée par défaut pour tout le quizz (sauf question la surchargeant explicitement). */
  @Column({ default: false })
  penaltyEnabled: boolean;

  /** Points retirés par défaut en cas de réponse fausse, si penaltyEnabled est vrai. */
  @Column({ type: 'float', nullable: true })
  penaltyPoints: number;

  @Column({ nullable: true })
  shareableLink: string;

  @OneToMany(() => QuizQuestion, (question) => question.quiz)
  questions: QuizQuestion[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

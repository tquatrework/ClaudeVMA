import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import {
  QuizQuestionCategory,
  MultipleChoiceScoringMode,
  ShortTextScoringMode,
} from '../enums/quiz-question-category.enum';

/** Choix affichable publiquement — jamais d'indicateur de correction ici. */
export interface QuizQuestionOption {
  id: string;
  text: string;
}

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  quizId: string;

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId' })
  quiz: Quiz;

  @Column({ type: 'int' })
  order: number;

  @Column({
    type: 'enum',
    enum: QuizQuestionCategory,
  })
  category: QuizQuestionCategory;

  @Column({ type: 'text' })
  prompt: string;

  /** Choix proposés (single_choice / multiple_choice). Public : {id, text} uniquement. */
  @Column({ type: 'jsonb', nullable: true })
  options: QuizQuestionOption[];

  /**
   * SOLUTION — identifiants des options correctes (single_choice / multiple_choice).
   * Ne doit jamais être exposé par une route publique.
   */
  @Column({ type: 'jsonb', nullable: true })
  correctOptionIds: string[];

  /**
   * SOLUTION — mots-clés attendus (short_text), comparaison insensible à la casse.
   * Ne doit jamais être exposé par une route publique.
   */
  @Column({ type: 'simple-array', nullable: true })
  keywords: string[];

  @Column({
    type: 'enum',
    enum: MultipleChoiceScoringMode,
    nullable: true,
  })
  multipleChoiceScoringMode: MultipleChoiceScoringMode;

  @Column({
    type: 'enum',
    enum: ShortTextScoringMode,
    nullable: true,
  })
  shortTextScoringMode: ShortTextScoringMode;

  /** Barème individuel — prévaut sur le barème global du quizz si renseigné. */
  @Column({ type: 'float', nullable: true })
  pointsOverride: number;

  /** Surcharge individuelle de l'activation de la pénalité — prévaut sur le réglage global du quizz. */
  @Column({ nullable: true })
  penaltyEnabledOverride: boolean;

  /** Surcharge individuelle du nombre de points de pénalité — prévaut sur le réglage global du quizz. */
  @Column({ type: 'float', nullable: true })
  penaltyPointsOverride: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Item de contenu texte/formule/image, même mécanisme que le Memo
 * (docs/architecture.md > « Refonte des Exercices », point 2).
 */
export interface ExerciseContentItem {
  type: 'text' | 'formula' | 'image';
  value: string;
}

/**
 * Détail par bloc question d'une tentative d'Exercice : une ligne par bloc
 * question de l'exercice (partId défini par content-catalog-service), créée
 * au démarrage de la tentative. Par bloc :
 *   - une réponse facultative (answerContent/answeredAt) ;
 *   - un indicateur de révélation de solution (solutionRevealed/revealedAt),
 *     avec le contenu obtenu via la médiation content-catalog-service, mis en
 *     cache ici pour ne jamais le redemander une fois révélé.
 *
 * C'est ce qui remplace conceptuellement l'ancien ExerciseAnswer de
 * content-catalog-service, désormais retiré de ce service (reconstruction,
 * pas migration de données).
 */
@Entity('exercise_attempt_parts')
@Index(['attemptId', 'partId'], { unique: true })
export class ExerciseAttemptPart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  attemptId: string;

  @Column()
  partId: string;

  @Column({ type: 'jsonb', nullable: true })
  answerContent: ExerciseContentItem[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt: Date | null;

  @Column({ default: false })
  solutionRevealed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  revealedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  revealedContent: ExerciseContentItem[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

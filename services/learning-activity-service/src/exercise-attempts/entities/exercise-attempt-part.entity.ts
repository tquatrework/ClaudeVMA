import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Item de réponse soumis par l'élève — même mécanisme texte/formule/image
 * que le Memo (docs/architecture.md > « Refonte des Exercices », point 2).
 * Forme propre à ce service (pas de contrat avec content-catalog-service ici :
 * la réponse de l'élève n'est jamais lue par content-catalog-service).
 */
export interface ExerciseAnswerItem {
  type: 'text' | 'formula' | 'image';
  content: string;
}

/**
 * Item de contenu tel que renvoyé par content-catalog-service pour un bloc
 * solution (POST /internal/exercises/:exerciseId/parts/:partId/solution),
 * contrat confirmé par sa PR #184 : `id` (référence de l'item, utilisée pour
 * les images via GET /internal/exercises/images/:itemId — pas de champ
 * imageId séparé), `type`, `order`, `content` (texte/LaTeX/légende, jamais
 * `value`), et `imageMimeType`/`imageSizeBytes` pour les items image. Stocké
 * tel quel dans revealedContent une fois révélé, jamais transformé.
 */
export interface ExerciseSolutionItem {
  id: string;
  type: 'text' | 'formula' | 'image';
  order: number;
  content: string;
  imageMimeType?: string;
  imageSizeBytes?: number;
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
  answerContent: ExerciseAnswerItem[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt: Date | null;

  @Column({ default: false })
  solutionRevealed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  revealedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  revealedContent: ExerciseSolutionItem[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

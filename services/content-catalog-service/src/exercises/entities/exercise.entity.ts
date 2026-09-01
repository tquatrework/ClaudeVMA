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
import { ExercisePart } from './exercise-part.entity';

/**
 * Exercise — refonte du 2026-08-29 (docs/architecture.md, "Refonte des
 * Exercices"). Un exercice est une séquence ordonnée de blocs typés
 * (`ExercisePart`), pas un énoncé unique + parties à réponse attendue.
 * `statement`/`correctionCost` retirés (remplacés par les blocs, et par le
 * retrait du flux de demande de correction humaine qui sort du périmètre des
 * Exercices — il relève de l'Évaluation).
 *
 * `title` redevient obligatoire le 2026-09-01 (docs/architecture.md, "Titre
 * des Exercices et des Quizz"), aligné sur `Quiz.title` — même règle
 * d'unicité par auteur, appliquée au niveau service (voir
 * `ExercisesService.resolveUniqueTitle` — disambiguation automatique par
 * suffixe "(N)" depuis le 2026-09-01, remplace l'ancien refus 400). La
 * colonne NOT NULL est posée par
 * la migration `MakeExerciseTitleRequired1791000000000`, qui backfille au
 * préalable les lignes créées avant cette règle (le champ était optionnel
 * jusque-là).
 *
 * Colonne `tags` en `text[]` postgres natif (et non `simple-array`), même
 * choix que `Quiz` (2026-08-28) : permet une recherche exacte par tag via
 * `ANY(tags)`, sans faux positif de sous-chaîne.
 *
 * Index UNIQUE partiel `(authorId, title)` posé par la migration
 * `AddExerciseQuizTitleUniqueConstraint1795000000000` (docs/architecture.md,
 * "Titre des Exercices et des Quizz : disambiguation automatique plutôt que
 * refus", point 3) — ferme la fenêtre de compétition (TOCTOU) entre la
 * vérification applicative (`ExercisesService.resolveUniqueTitle`) et
 * l'écriture. Partiel (`WHERE status != 'removed'`) : cohérent avec
 * `titleTakenByAuthor`, qui exclut déjà ce statut de la vérification. Le
 * retry applicatif sur violation `23505` de CET index précis vit dans
 * `ExercisesService` (`isPostgresUniqueViolation`,
 * `src/common/utils/postgres-errors.ts`).
 */
@Entity('exercises')
@Index('IDX_exercise_author_title_unique', ['authorId', 'title'], {
  unique: true,
  where: "status != 'removed'",
})
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

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

  @OneToMany(() => ExercisePart, (part) => part.exercise, { cascade: true })
  parts: ExercisePart[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

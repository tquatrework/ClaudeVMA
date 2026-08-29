import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Une tentative d'Exercice, pour de l'auto-contrôle : pas de notation, pas de
 * correction automatique (contrairement au Quizz). Porte tout le cycle de vie
 * (démarrage, réponses, révélations, historique) — docs/architecture.md >
 * « Refonte des Exercices ».
 *
 * Ne duplique jamais la définition de l'exercice (titre, énoncés, tags) :
 * seul l'ensemble des blocs question (voir ExerciseAttemptPart) est copié
 * depuis content-catalog-service au démarrage, pour connaître le nombre et
 * l'ordre des zones de réponse sans avoir à le redemander à chaque lecture.
 */
@Entity('exercise_attempts')
export class ExerciseAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  exerciseId: string;

  @Column()
  userId: string;

  @Column()
  userRole: string;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

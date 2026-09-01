import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
  CreateDateColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';
import { ExerciseContentItem } from './exercise-content-item.entity';
import { ExerciseSolution } from './exercise-solution.entity';
import { ExercisePartCategory } from '../enums/exercise-part-category.enum';

/**
 * ExercisePart — bloc ordonné d'un exercice (refonte du 2026-08-29, étendue
 * le 2026-09-01). Un exercice est une séquence libre de blocs `statement`
 * (énoncé), `image` et `question`, plusieurs blocs `statement`/`image`
 * étant possibles et librement entrelacés avec des blocs `question`.
 * `partNumber` porte l'ordre explicite de la séquence.
 *
 * Le contenu est porté par les `items` enfants (`ExerciseContentItem`) :
 * texte/formule pour `statement`/`question`, EXACTEMENT un item de type
 * `image` pour un bloc `image` (arbitrage du 2026-09-01, "Bloc 'image' de
 * premier niveau pour l'Exercice" — l'image est un bloc à part entière, plus
 * un item parmi d'autres au sein d'un bloc `statement`/`question`).
 */
@Entity('exercise_parts')
export class ExercisePart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  exerciseId: string;

  @ManyToOne(() => Exercise, (exercise) => exercise.parts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @Column()
  partNumber: number;

  @Column({
    type: 'enum',
    enum: ExercisePartCategory,
  })
  category: ExercisePartCategory;

  @OneToMany(() => ExerciseContentItem, (item) => item.part, { cascade: true })
  items: ExerciseContentItem[];

  /** Solution 1-à-1 — présente uniquement pour un bloc `question`. */
  @OneToOne(() => ExerciseSolution, (solution) => solution.part)
  solution: ExerciseSolution | null;

  @CreateDateColumn()
  createdAt: Date;
}

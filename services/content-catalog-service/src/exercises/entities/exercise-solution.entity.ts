import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';
import { ExercisePart } from './exercise-part.entity';
import { ExerciseContentItem } from './exercise-content-item.entity';

/**
 * ExerciseSolution — refonte du 2026-08-29 : 1-à-1 avec un bloc `question`
 * (FK `partId` obligatoire, unique), plus `cost`/`isOfficial`/solutions
 * concurrentes — un exercice a EXACTEMENT une solution par question. Contenu
 * texte/formule/image porté par les `items` enfants, comme les blocs.
 *
 * Ne doit JAMAIS être exposée par une route publique : `GET /exercises/:id`
 * ne renvoie que les blocs, jamais leur solution. Seule
 * `learning-activity-service` y accède, via la route interne
 * `POST /internal/exercises/:exerciseId/parts/:partId/solution`.
 */
@Entity('exercise_solutions')
export class ExerciseSolution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  exerciseId: string;

  @ManyToOne(() => Exercise, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @Column({ unique: true })
  partId: string;

  @OneToOne(() => ExercisePart, (part) => part.solution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partId' })
  part: ExercisePart;

  @Column()
  authorId: string;

  @Column()
  authorRole: string;

  @OneToMany(() => ExerciseContentItem, (item) => item.solution, { cascade: true })
  items: ExerciseContentItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

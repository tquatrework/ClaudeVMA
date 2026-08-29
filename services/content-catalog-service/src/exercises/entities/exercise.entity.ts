import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { ExercisePart } from './exercise-part.entity';

/**
 * Exercise — refonte du 2026-08-29 (docs/architecture.md, "Refonte des
 * Exercices"). Un exercice est une séquence ordonnée de blocs typés
 * (`ExercisePart`), pas un énoncé unique + parties à réponse attendue.
 * `statement`/`correctionCost` retirés (remplacés par les blocs, et par le
 * retrait du flux de demande de correction humaine qui sort du périmètre des
 * Exercices — il relève de l'Évaluation). `title` devient optionnel.
 *
 * Colonne `tags` en `text[]` postgres natif (et non `simple-array`), même
 * choix que `Quiz` (2026-08-28) : permet une recherche exacte par tag via
 * `ANY(tags)`, sans faux positif de sous-chaîne.
 */
@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  title: string | null;

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

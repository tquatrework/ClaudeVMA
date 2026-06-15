import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('student_pedagogical_profiles')
export class StudentPedagogicalProfile {
  /** userId from identity-access-service — one-to-one with eleve accounts */
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ name: 'niveau_scolaire', nullable: true })
  niveauScolaire: string;

  /** Comma-separated list of subjects or JSON array stored as text */
  @Column({ type: 'simple-array', nullable: true })
  matieres: string[];

  @Column({ name: 'objectifs_pedagogiques', nullable: true, type: 'text' })
  objectifsPedagogiques: string;

  @Column({ name: 'besoins_specifiques', nullable: true, type: 'text' })
  besoinsSpecifiques: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

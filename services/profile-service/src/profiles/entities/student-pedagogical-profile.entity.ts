import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Profil pédagogique d'un élève.
 *
 * Propriétés en anglais, noms de colonnes en base inchangés — voir la note de
 * convention dans administrative-profile.entity.ts.
 */
@Entity('student_pedagogical_profiles')
export class StudentPedagogicalProfile {
  /** userId from identity-access-service — one-to-one with eleve accounts */
  @PrimaryColumn('uuid')
  userId: string;

  /** Niveau scolaire suivi (e.g. "3ème", "Terminale"). */
  @Column({ name: 'niveau_scolaire', nullable: true })
  level: string;

  /** Matières étudiées par l'élève. */
  @Column({ name: 'matieres', type: 'simple-array', nullable: true })
  subjects: string[];

  /** Objectifs pédagogiques de l'élève. */
  @Column({ name: 'objectifs_pedagogiques', nullable: true, type: 'text' })
  goals: string;

  /** Besoins d'apprentissage spécifiques (aménagements, troubles…). */
  @Column({ name: 'besoins_specifiques', nullable: true, type: 'text' })
  specificNeeds: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

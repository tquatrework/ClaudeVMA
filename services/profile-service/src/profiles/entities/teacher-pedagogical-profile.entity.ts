import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('teacher_pedagogical_profiles')
export class TeacherPedagogicalProfile {
  /** userId from identity-access-service — one-to-one with formateur/AP accounts */
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'simple-array', name: 'niveaux_enseignes', nullable: true })
  niveauxEnseignes: string[];

  @Column({ type: 'simple-array', name: 'matieres_enseignees', nullable: true })
  matieresEnseignees: string[];

  @Column({ name: 'experience_pedagogique', nullable: true, type: 'text' })
  experiencePedagogique: string;

  /** Free-text summary of test results / evaluation scores */
  @Column({ name: 'resultats_tests', nullable: true, type: 'text' })
  resultatsTests: string;

  /**
   * PROF-BR-008 : whether this formateur also acts as Animateur Pédagogique.
   * Promoted via POST /profiles/:teacherId/ap-status (RP only).
   */
  @Column({ name: 'is_animateur_pedagogique', default: false })
  isAnimateurPedagogique: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

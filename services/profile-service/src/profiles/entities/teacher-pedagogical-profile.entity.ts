import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Profil pédagogique d'un formateur.
 *
 * Propriétés en anglais, noms de colonnes en base inchangés — voir la note de
 * convention dans administrative-profile.entity.ts.
 * `levels`/`subjects` désignent ici implicitement les niveaux et matières
 * *enseignés* : le contexte est porté par l'entité elle-même, rien n'est perdu
 * par rapport à `niveauxEnseignes`/`matieresEnseignees`. Ces deux noms sont par
 * ailleurs déjà ceux du DTO interne CreateTeacherProfilesDto.
 */
@Entity('teacher_pedagogical_profiles')
export class TeacherPedagogicalProfile {
  /** userId from identity-access-service — one-to-one with formateur/AP accounts */
  @PrimaryColumn('uuid')
  userId: string;

  /** Niveaux scolaires enseignés. */
  @Column({ type: 'simple-array', name: 'niveaux_enseignes', nullable: true })
  levels: string[];

  /** Matières enseignées. */
  @Column({ type: 'simple-array', name: 'matieres_enseignees', nullable: true })
  subjects: string[];

  /** Expérience pédagogique (texte libre). */
  @Column({ name: 'experience_pedagogique', nullable: true, type: 'text' })
  experience: string;

  /** Free-text summary of test results / evaluation scores */
  @Column({ name: 'resultats_tests', nullable: true, type: 'text' })
  testResults: string;

  /**
   * PROF-BR-008 : whether this formateur also acts as Animateur Pédagogique.
   * Promoted via POST /profiles/:teacherId/ap-status (RP only).
   * Nom conservé : « Animateur Pédagogique » est un nom de rôle métier du
   * domaine, repris tel quel dans l'énumération UserRole, les autres services
   * et le front — le traduire créerait une divergence, pas une clarification.
   */
  @Column({ name: 'is_animateur_pedagogique', default: false })
  isAnimateurPedagogique: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

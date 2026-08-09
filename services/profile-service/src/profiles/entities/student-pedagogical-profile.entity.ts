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
 * UN SEUL profil pédagogique par rôle, DEUX sections aux droits distincts
 * (docs/proposition-profils.md §1 et §6) :
 *
 *  - section DÉCLARATIVE : écrite par le titulaire (ou un administrateur de son
 *    domaine) via PUT /profiles/:userId/pedagogical ;
 *  - section PRESCRIPTION : écrite par le RESPONSABLE PÉDAGOGIQUE SEUL via
 *    PUT /profiles/:userId/prescription. Le titulaire la LIT mais ne l'écrit
 *    jamais — un élève ne rédige pas ses propres préconisations.
 *
 * La séparation des droits est portée par les routes, pas par le schéma : les
 * deux sections cohabitent volontairement dans la même table.
 *
 * Propriétés en anglais. Les colonnes historiques restent en français (voir la
 * note de convention dans administrative-profile.entity.ts) ; les colonnes
 * ajoutées par le chantier « profils complets » sont en anglais snake_case.
 */
@Entity('student_pedagogical_profiles')
export class StudentPedagogicalProfile {
  /** userId from identity-access-service — one-to-one with eleve accounts */
  @PrimaryColumn('uuid')
  userId: string;

  // ---------------------------------------------------------------------------
  // Section déclarative — écrite par l'élève
  // ---------------------------------------------------------------------------

  /** Niveau scolaire suivi (e.g. "3ème", "Terminale"). */
  @Column({ name: 'niveau_scolaire', nullable: true })
  level: string;

  /** Matières étudiées par l'élève. */
  @Column({ name: 'matieres', type: 'simple-array', nullable: true })
  subjects: string[];

  /** Objectifs pédagogiques de l'élève. */
  @Column({ name: 'objectifs_pedagogiques', nullable: true, type: 'text' })
  goals: string;

  /**
   * Aménagements reconnus : DYS, PAP, PPS.
   * À NE PAS confondre avec `difficulties` : `specificNeeds` décrit un
   * aménagement reconnu, `difficulties` une difficulté d'apprentissage. Les
   * fusionner reviendrait à traiter un trouble comme une simple faiblesse.
   */
  @Column({ name: 'besoins_specifiques', nullable: true, type: 'text' })
  specificNeeds: string;

  /** Ce sur quoi l'élève bute (difficulté d'apprentissage déclarée). */
  @Column({ name: 'difficulties', nullable: true, type: 'text' })
  difficulties: string;

  /** Situation scolaire et familiale utile au suivi. */
  @Column({ name: 'context', nullable: true, type: 'text' })
  context: string;

  // ---------------------------------------------------------------------------
  // Section prescription — écrite par le RP seul, lue par le titulaire
  // ---------------------------------------------------------------------------

  /** Considération générale du RP sur l'élève. */
  @Column({ name: 'general_assessment', nullable: true, type: 'text' })
  generalAssessment: string;

  /** Rythme de travail préconisé. */
  @Column({ name: 'recommended_pace', nullable: true, type: 'text' })
  recommendedPace: string;

  /** Type de formateur préconisé. */
  @Column({ name: 'recommended_teacher_profile', nullable: true, type: 'text' })
  recommendedTeacherProfile: string;

  /** Parcours pédagogique préconisé. */
  @Column({ name: 'recommended_path', nullable: true, type: 'text' })
  recommendedPath: string;

  /** Activités préconisées. */
  @Column({ name: 'recommended_activities', nullable: true, type: 'text' })
  recommendedActivities: string;

  /**
   * userId du RP auteur de la prescription. Renseigné CÔTÉ SERVEUR à partir de
   * l'acteur authentifié, jamais depuis le corps de la requête : c'est ce qui
   * rend la prescription opposable — on doit savoir qui a prescrit quoi.
   */
  @Column({ name: 'filled_by', type: 'uuid', nullable: true })
  filledBy: string;

  /** Horodatage de la dernière écriture de prescription, posé côté serveur. */
  @Column({ name: 'filled_at', type: 'timestamp', nullable: true })
  filledAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

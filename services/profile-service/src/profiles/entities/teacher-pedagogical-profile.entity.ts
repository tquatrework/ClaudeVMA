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
 * Même structure à deux sections que le profil élève (voir
 * student-pedagogical-profile.entity.ts) : une section DÉCLARATIVE écrite par
 * le formateur, une section PRESCRIPTION écrite par le RESPONSABLE
 * PÉDAGOGIQUE SEUL et seulement lue par le formateur.
 *
 * `levels`/`subjects` désignent ici implicitement les niveaux et matières
 * *enseignés* : le contexte est porté par l'entité elle-même.
 */
@Entity('teacher_pedagogical_profiles')
export class TeacherPedagogicalProfile {
  /** userId from identity-access-service — one-to-one with formateur/AP accounts */
  @PrimaryColumn('uuid')
  userId: string;

  // ---------------------------------------------------------------------------
  // Section déclarative — écrite par le formateur
  // ---------------------------------------------------------------------------

  /** Niveaux scolaires enseignés. */
  @Column({ type: 'simple-array', name: 'niveaux_enseignes', nullable: true })
  levels: string[];

  /** Matières enseignées. */
  @Column({ type: 'simple-array', name: 'matieres_enseignees', nullable: true })
  subjects: string[];

  /** Expérience pédagogique (texte libre). */
  @Column({ name: 'experience_pedagogique', nullable: true, type: 'text' })
  experience: string;

  /** Titres et certifications déclarés (texte libre). */
  @Column({ name: 'diplomas', nullable: true, type: 'text' })
  diplomas: string;

  /**
   * Spécialités pédagogiques — DISTINCT de `subjects` : « préparation Grand
   * Oral », « remise à niveau », « accompagnement post-bac »… `subjects` porte
   * la matière, `specialties` le type d'accompagnement.
   */
  @Column({ type: 'simple-array', name: 'specialties', nullable: true })
  specialties: string[];

  /** Modalités, contraintes, publics particuliers (texte libre). */
  @Column({ name: 'particularities', nullable: true, type: 'text' })
  particularities: string;

  /**
   * RÉFÉRENCE du CV auprès d'archive-document-service — jamais une URL de
   * fichier. Stocker une URL en dur ici contournerait le service propriétaire
   * des documents et créerait une seconde source de vérité
   * (docs/proposition-profils.md §2).
   */
  @Column({ name: 'cv_document_id', type: 'varchar', length: 255, nullable: true })
  cvDocumentId: string;

  /**
   * PROF-BR-008 : whether this formateur also acts as Animateur Pédagogique.
   * C'est un DROIT, pas une déclaration : il est attribué par le RP via
   * POST /profiles/:teacherId/ap-status et ne figure PAS dans le DTO de mise à
   * jour du profil pédagogique — l'y laisser exposait une promotion de rôle à
   * une route d'auto-édition.
   * Nom conservé : « Animateur Pédagogique » est un nom de rôle métier du
   * domaine, repris tel quel dans l'énumération UserRole, les autres services
   * et le front — le traduire créerait une divergence, pas une clarification.
   */
  @Column({ name: 'is_animateur_pedagogique', default: false })
  isAnimateurPedagogique: boolean;

  // ---------------------------------------------------------------------------
  // Section prescription — écrite par le RP seul, lue par le titulaire
  // ---------------------------------------------------------------------------

  /** Niveau maximum validé par le RP pour ce formateur. */
  @Column({ name: 'max_validated_level', type: 'varchar', length: 100, nullable: true })
  maxValidatedLevel: string;

  /** Type de public que le formateur est habilité à accompagner. */
  @Column({ name: 'audience_type', nullable: true, type: 'text' })
  audienceType: string;

  /**
   * Résultats des tests d'évaluation.
   * MIGRÉ de la section déclarative vers la section prescription : ces
   * résultats sont une évaluation MENÉE PAR LE RP. Les laisser dans le bloc
   * auto-édité permettait à un formateur d'écrire lui-même ses propres
   * résultats de test. La colonne `resultats_tests` est inchangée — seul le
   * droit d'écriture change, aucune donnée existante n'est déplacée.
   */
  @Column({ name: 'resultats_tests', nullable: true, type: 'text' })
  testResults: string;

  /** Commentaires du RP sur les tests. */
  @Column({ name: 'test_comments', nullable: true, type: 'text' })
  testComments: string;

  /**
   * userId du RP auteur de la prescription, renseigné côté serveur à partir de
   * l'acteur authentifié — jamais depuis le corps de la requête.
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

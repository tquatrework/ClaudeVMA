import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stores an élève's visibility preferences for their pedagogical profile fields.
 * PROF-FN-004 / acceptance criterion:
 *   An élève may hide difficulties/comments from contacts other than their financeur and principal teacher.
 */
@Entity('profile_visibility_preferences')
export class ProfileVisibilityPreference {
  /** Same as the élève's userId — one-to-one mapping */
  @PrimaryColumn('uuid')
  userId: string;

  /**
   * When true, besoinsSpecifiques and objectifsPedagogiques are hidden
   * from contacts other than the financeur and principal teacher (PP).
   */
  @Column({ name: 'hide_difficulties_from_contacts', default: false })
  hideDifficultiesFromContacts: boolean;

  /**
   * When true, personal comments visible to formateurs are restricted
   * to the principal teacher only.
   */
  @Column({ name: 'restrict_comments_to_principal_teacher', default: false })
  restrictCommentsToPrincipalTeacher: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

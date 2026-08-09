import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FieldAudience } from '../field-visibility.catalog';

/**
 * Visibilité d'un champ de profil, choisie par l'utilisateur.
 *
 * Remplace `profile_visibility_preferences`, qui portait deux booléens nommés
 * en dur (`hide_difficulties_from_contacts`,
 * `restrict_comments_to_principal_teacher`) : chaque nouveau champ masquable y
 * aurait ajouté une colonne, le modèle ne tenait pas
 * (docs/proposition-profils.md §8).
 *
 * UNE LIGNE = UNE DÉROGATION. Un champ absent de cette table prend la
 * visibilité par défaut de son bloc, portée par FIELD_VISIBILITY_CATALOG.
 * Ne pas matérialiser les valeurs par défaut : sinon toute évolution du socle
 * exigerait un backfill, et on ne saurait plus distinguer un choix explicite
 * de l'utilisateur d'un défaut recopié.
 */
@Entity('profile_field_visibility')
@Unique('UQ_profile_field_visibility_user_field', ['userId', 'fieldName'])
export class ProfileFieldVisibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Titulaire du profil concerné. */
  @Index('IDX_profile_field_visibility_user')
  @Column('uuid')
  userId: string;

  /**
   * Nom technique du champ, en anglais, tel qu'il apparaît dans les réponses
   * de l'API. Validé contre FIELD_VISIBILITY_CATALOG à l'écriture : un nom
   * inconnu est refusé en 400, jamais absorbé en silence.
   */
  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string;

  /**
   * self   — visible du seul titulaire (et des administrateurs)
   * linked — visible aussi des personnes liées (parent↔élève, formateur↔élève…)
   * all    — visible de tout utilisateur authentifié
   */
  @Column({ type: 'varchar', length: 16 })
  audience: FieldAudience;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  ELEVE = 'eleve',
  PARENT_FINANCEUR = 'parent_financeur',
  FORMATEUR = 'formateur',
  ANIMATEUR_PEDAGOGIQUE = 'animateur_pedagogique',
  RESPONSABLE_PEDAGOGIQUE = 'responsable_pedagogique',
  TECHNICIEN_INFORMATIQUE = 'technicien_informatique',
  ADMINISTRATEUR_FINANCIER = 'administrateur_financier',
}

export enum ValidationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

/** Roles that users cannot self-assign (IAM-FB-002) */
export const INTERNAL_ROLES: UserRole[] = [
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

/** Roles allowed for self-registration */
export const SELF_REGISTRATION_ROLES: UserRole[] = [
  UserRole.ELEVE,
  UserRole.PARENT_FINANCEUR,
  UserRole.FORMATEUR,
];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ELEVE })
  role: UserRole;

  @Column({
    name: 'validation_status',
    type: 'enum',
    enum: ValidationStatus,
    default: ValidationStatus.PENDING,
  })
  validationStatus: ValidationStatus;

  /** True once all required RGPD consents have been recorded (IAM-FB-003) */
  @Column({ name: 'consent_signed', default: false })
  consentSigned: boolean;

  @Column({ name: 'first_name', nullable: true, type: 'varchar', length: 100 })
  firstName: string | null;

  @Column({ name: 'last_name', nullable: true, type: 'varchar', length: 100 })
  lastName: string | null;

  @Column({ name: 'phone', nullable: true, type: 'varchar', length: 30 })
  phone: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

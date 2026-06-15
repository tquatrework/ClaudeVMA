import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('administrative_profiles')
export class AdministrativeProfile {
  /** userId from identity-access-service — one-to-one mapping */
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ name: 'date_naissance', type: 'date', nullable: true })
  dateNaissance: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ nullable: true })
  adresseLigne1: string;

  @Column({ nullable: true })
  adresseLigne2: string;

  @Column({ nullable: true })
  codePostal: string;

  @Column({ nullable: true })
  ville: string;

  @Column({ nullable: true })
  pays: string;

  /** URL or path to avatar image stored in object storage */
  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  /** Département de résidence (e.g. "75 - Paris") */
  @Column({ nullable: true })
  departement: string;

  /** Comma-separated or JSON list of personal interests/hobbies */
  @Column({ type: 'simple-array', nullable: true })
  passions: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

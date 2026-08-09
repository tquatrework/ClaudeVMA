import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Profil administratif d'un utilisateur.
 *
 * Convention de nommage (arbitrage du 2026-08-07) : les propriétés d'entité et
 * les champs de DTO sont en anglais. Les NOMS DE COLONNES en base restent
 * inchangés (`telephone`, `adresseLigne1`, `codePostal`, `ville`, `pays`,
 * `departement`…) et sont explicitement mappés via `@Column({ name })` : la
 * base de dev n'est gérée ni par des migrations ni par `synchronize`
 * (`synchronize: false` dans AppModule, aucun outil de migration dans le
 * service), un renommage de colonne serait donc un ALTER manuel non rejouable
 * et non tracé. Le mapping ci-dessous obtient le même résultat côté API sans
 * aucune opération sur la base.
 */
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
  birthDate: string;

  @Column({ name: 'telephone', nullable: true })
  phone: string;

  /** Première ligne d'adresse (numéro et voie) — pas l'adresse complète. */
  @Column({ name: 'adresseLigne1', nullable: true })
  addressLine1: string;

  /** Seconde ligne d'adresse (appartement, étage, bâtiment…). */
  @Column({ name: 'adresseLigne2', nullable: true })
  addressLine2: string;

  @Column({ name: 'codePostal', nullable: true })
  postalCode: string;

  @Column({ name: 'ville', nullable: true })
  city: string;

  @Column({ name: 'pays', nullable: true })
  country: string;

  /** URL or path to avatar image stored in object storage */
  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  /** Département de résidence (découpage administratif français, e.g. "75 - Paris") */
  @Column({ name: 'departement', nullable: true })
  department: string;

  /**
   * Centres d'intérêt / hobbies. Nom conservé tel quel : `passions` est un mot
   * anglais valide, identique au français — rien à traduire.
   */
  @Column({ type: 'simple-array', nullable: true })
  passions: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

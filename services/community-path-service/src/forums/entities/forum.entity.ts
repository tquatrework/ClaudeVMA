import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ForumComment } from './forum-comment.entity';
import { ForumExclusion } from './forum-exclusion.entity';

@Entity('forums')
export class Forum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  difficulty: string;

  @Column({ nullable: true })
  theme: string;

  @Column({ nullable: true })
  competences: string;

  @Column({ nullable: true })
  tags: string;

  /**
   * Liste des rôles autorisés à voir et à participer au forum. `null` (ou
   * tableau vide) signifie "ouvert à tous les comptes connectés" — valeur
   * par défaut. Les rôles administratifs (RP, AF, TI) gardent de toute
   * façon un accès illimité, voir FORUM_ADMIN_BYPASS_ROLES.
   * Remplace l'ancien enum ForumPublic (etudiant/mixte/professeur), retiré
   * le 2026-09-04 car trop étroit pour cette spécification.
   */
  @Column({ type: 'text', array: true, nullable: true })
  allowedRoles: string[] | null;

  @Column()
  createdById: string;

  @Column()
  createdByRole: string;

  /**
   * Nom de fichier généré côté serveur pour l'image d'illustration, stockée
   * sur le volume dédié à ce service (jamais un chemin fourni par le
   * client). `null` tant qu'aucune image n'a été envoyée.
   */
  @Column({ nullable: true })
  imageFilename: string | null;

  @Column({ nullable: true })
  imageMimeType: string | null;

  /**
   * Masquage total (RP uniquement) — arbitrage du 2026-09-04. Un forum caché
   * n'apparaît plus dans GET /forums ni GET /forums/:id pour aucun rôle sauf
   * le RP (masquage 404, pas de 403 — même discipline que la restriction par
   * rôle). Non destructif : jamais de suppression de ligne, seul cet
   * indicateur change — même principe déjà appliqué ailleurs dans ce projet
   * (consentements, relations, validations de contenu). Aucune route de
   * réouverture n'existe pour l'instant, mais le design reste réversible
   * (flip du booléen) si le besoin apparaît plus tard.
   */
  @Column({ default: false })
  isHidden: boolean;

  @Column({ type: 'timestamp', nullable: true })
  hiddenAt: Date | null;

  @Column({ nullable: true })
  hiddenByUserId: string | null;

  @OneToMany(() => ForumComment, (comment) => comment.forum, { cascade: true })
  comments: ForumComment[];

  @OneToMany(() => ForumExclusion, (exclusion) => exclusion.forum, { cascade: true })
  exclusions: ForumExclusion[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

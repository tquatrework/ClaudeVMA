import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Forum } from './forum.entity';
import { ForumComment } from './forum-comment.entity';
import { ForumTopicStatus } from '../../common/enums/forum-topic-status.enum';

/**
 * Sujet (topic) d'un forum — arbitrage du 2026-09-04 ("Structure en sujets
 * (topics) des Forums"). Un forum n'est plus une discussion plate : il
 * contient des sujets, chacun portant sa propre discussion (des
 * `ForumComment`, désormais rattachés au sujet et non plus directement au
 * forum).
 *
 * Le premier message d'un sujet EST son premier `ForumComment` (choix de
 * modélisation de l'arbitrage) : cette entité ne porte donc aucun champ de
 * contenu, seulement un `title`.
 */
@Entity('forum_topics')
export class ForumTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  forumId: string;

  @ManyToOne(() => Forum, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'forumId' })
  forum: Forum;

  @Column()
  title: string;

  @Column()
  authorId: string;

  @Column()
  authorRole: string;

  @Column({ type: 'enum', enum: ForumTopicStatus, default: ForumTopicStatus.PENDING_VALIDATION })
  status: ForumTopicStatus;

  /**
   * `true` uniquement pour le sujet système "Sujet général", créé
   * automatiquement (et déjà `VALIDATED`) à la création de chaque forum.
   * Sert à l'exclure du flux de décision RP (pas de validation/refus
   * possible sur un sujet système) et à le distinguer/l'épingler à
   * l'affichage.
   */
  @Column({ default: false })
  isDefault: boolean;

  @Column({ nullable: true })
  validatedByUserId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date | null;

  @Column({ nullable: true })
  rejectedByUserId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @OneToMany(() => ForumComment, (comment) => comment.topic, { cascade: true })
  comments: ForumComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

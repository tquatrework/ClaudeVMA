import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('site_metadata')
export class SiteMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique key identifying this metadata entry (e.g. "home_url", "og_title"). */
  @Column({ unique: true })
  metaKey: string;

  @Column({ type: 'text' })
  metaValue: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  lastModifiedById: string;

  @Column()
  lastModifiedByRole: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

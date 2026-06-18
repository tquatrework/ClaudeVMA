import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('visibility_overrides')
export class VisibilityOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  resourceType: string;

  @Column()
  resourceId: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column()
  createdById: string;

  @Column()
  createdByRole: string;

  /** isActive=true means the element is currently hidden. */
  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  liftedById: string;

  @Column({ type: 'timestamptz', nullable: true })
  liftedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

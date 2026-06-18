import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ActivityStatus } from '../../common/enums/activity-status.enum';
import { ActivitySource } from '../../common/enums/activity-source.enum';
import { RewardType } from '../../common/enums/reward-type.enum';
import { ActivityAcceptance } from './activity-acceptance.entity';

@Entity('open_activities')
export class OpenActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ActivitySource,
    default: ActivitySource.RP_PRODUCTION,
  })
  source: ActivitySource;

  @Column({ nullable: true })
  sourceReferenceId: string;

  @Column()
  publishedById: string;

  @Column()
  publishedByRole: string;

  @Column({
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.OPEN,
  })
  status: ActivityStatus;

  @Column({
    type: 'enum',
    enum: RewardType,
    default: RewardType.PEDAGOGICAL_POINTS,
  })
  rewardType: RewardType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  rewardAmount: number;

  @Column({ type: 'int', default: 1 })
  maxAcceptances: number;

  @Column({ type: 'int', default: 0 })
  currentAcceptances: number;

  @Column({ type: 'timestamptz', nullable: true })
  deadline: Date;

  @OneToMany(() => ActivityAcceptance, (acceptance) => acceptance.openActivity, { cascade: true })
  acceptances: ActivityAcceptance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

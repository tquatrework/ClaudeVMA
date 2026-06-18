import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OpenActivity } from './open-activity.entity';

@Entity('activity_acceptances')
export class ActivityAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  openActivityId: string;

  @ManyToOne(() => OpenActivity, (activity) => activity.acceptances)
  @JoinColumn({ name: 'openActivityId' })
  openActivity: OpenActivity;

  @Column()
  teacherId: string;

  @Column({ nullable: true })
  calendarEventId: string;

  @CreateDateColumn()
  acceptedAt: Date;
}

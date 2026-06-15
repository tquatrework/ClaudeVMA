import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
}

@Entity('notification_subscriptions')
export class NotificationSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

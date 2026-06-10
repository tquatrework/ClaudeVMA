import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('dashboard_widget_states')
export class DashboardWidgetState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'widget_type' })
  widgetType: string;

  @Column({ type: 'jsonb', default: '{}' })
  data: Record<string, unknown>;

  @UpdateDateColumn({ name: 'last_refreshed_at' })
  lastRefreshedAt: Date;
}

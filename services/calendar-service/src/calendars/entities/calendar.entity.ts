import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AvailabilitySlot } from './availability-slot.entity';

/**
 * Represents a user's calendar (CAL-BR-001 to CAL-BR-004).
 * One calendar per user, identified by ownerId + ownerRole.
 */
@Entity('calendars')
export class Calendar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user this calendar belongs to (userId from identity-access-service) */
  @Column({ name: 'owner_id' })
  ownerId: string;

  /** Role of the owner, drives business rules and access */
  @Column({ name: 'owner_role' })
  ownerRole: string;

  @OneToMany(() => AvailabilitySlot, (slot) => slot.calendar, { cascade: true, eager: false })
  availabilitySlots: AvailabilitySlot[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

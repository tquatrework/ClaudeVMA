import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RoomStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  ENDED = 'ended',
}

@Entity('video_rooms')
export class VideoRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Legacy/manual link: an opaque UUID supplied by the caller of `POST /video/rooms`
   * (formateur/RP/AP/TI). No entity reference is verified against it — it has always
   * been a free-form UUID, not a real foreign key to `calendar-service`.
   * Nullable since rooms created automatically from `activityId` (see below) do not
   * carry one (chantier calendrier de disponibilites, point 4, 2026-08-19).
   */
  @Column({ name: 'calendar_session_id', nullable: true })
  calendarSessionId: string | null;

  /**
   * Real reference to `calendar-service`'s `ScheduledActivity.id` (the "activities"
   * resource introduced by the calendrier de disponibilites chantier, point 3), set
   * only for rooms created automatically when that activity is confirmed
   * (`ActivityConfirmed` event, type "cours"). Distinct from `calendarSessionId`
   * above: same rule as elsewhere in this project ("un seul nom par donnee, mais
   * deux donnees distinctes gardent chacune le sien") — this is a genuinely
   * different concept, not a renaming of the legacy field.
   */
  @Column({ name: 'activity_id', unique: true, nullable: true })
  activityId: string | null;

  /**
   * Real LiveKit room name (chantier calendrier-visio-livekit, point 4, 2026-08-19).
   * Historically a locally generated opaque UUID with nothing behind it; it is now
   * the exact `name` used to create the room via `RoomServiceClient.createRoom()`
   * and the `room` grant used when minting an `AccessToken`.
   */
  @Column({ name: 'room_token', unique: true })
  roomToken: string;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.WAITING })
  status: RoomStatus;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

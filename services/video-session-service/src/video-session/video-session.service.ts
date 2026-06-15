import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VideoRoom, RoomStatus } from './entities/video-room.entity';
import { VideoAccessToken } from './entities/video-access-token.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { UserRole } from '../common/enums/user-role.enum';

/** Roles that are authorised to join a video room (VID-RA-001, VID-RA-002, VID-FB-001). */
const ALLOWED_PARTICIPANT_ROLES: string[] = [
  UserRole.ELEVE,
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/** How long a generated access token remains valid (in minutes). */
const TOKEN_TTL_MINUTES = 60;

@Injectable()
export class VideoSessionService {
  private readonly logger = new Logger(VideoSessionService.name);

  constructor(
    @InjectRepository(VideoRoom)
    private readonly roomRepo: Repository<VideoRoom>,
    @InjectRepository(VideoAccessToken)
    private readonly tokenRepo: Repository<VideoAccessToken>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  // ─── Room lifecycle ──────────────────────────────────────────────────────────

  /**
   * Create a new video room linked to a calendar activity.
   * VID-FB-003: calendarSessionId is mandatory.
   * VID-BR-004: room is created in WAITING state until first participant joins.
   *
   * Publishes: VideoRoomCreated (logged to stdout for now; event bus integration is phase 2).
   */
  async create(dto: CreateRoomDto, creatorId: string, creatorRole: string): Promise<VideoRoom> {
    // Only formateur, RP, AP and TI may create rooms
    if (
      creatorRole !== UserRole.FORMATEUR &&
      creatorRole !== UserRole.RESPONSABLE_PEDAGOGIQUE &&
      creatorRole !== UserRole.ANIMATEUR_PEDAGOGIQUE &&
      creatorRole !== UserRole.TECHNICIEN_INFORMATIQUE
    ) {
      throw new ForbiddenException('Only a formateur or pedagogical staff can create a room');
    }

    const room = this.roomRepo.create({
      calendarSessionId: dto.calendarSessionId,
      roomToken: uuidv4(),
      status: RoomStatus.WAITING,
    });
    const saved = await this.roomRepo.save(room);

    this.publishEvent('VideoRoomCreated', {
      roomId: saved.id,
      calendarSessionId: saved.calendarSessionId,
      createdBy: creatorId,
      createdAt: saved.createdAt,
    });

    return saved;
  }

  /**
   * Retrieve room details (all authenticated users may query a room by ID).
   */
  async findOne(id: string): Promise<VideoRoom> {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }

  /**
   * Generate an access token allowing an authorised participant to join.
   * VID-BR-005: tokens are created only for allowed roles.
   * VID-FB-001: parent_financeur is explicitly blocked.
   * VID-FB-002: the token is scoped to the requesting user.
   *
   * Publishes: VideoSessionStarted when the room transitions from WAITING → ACTIVE.
   */
  async join(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<{ accessToken: string; roomToken: string; status: RoomStatus }> {
    // VID-FB-001 / VID-RA-003
    if (!ALLOWED_PARTICIPANT_ROLES.includes(userRole)) {
      throw new ForbiddenException('Your role does not grant access to this video room');
    }

    const room = await this.findOne(id);

    if (room.status === RoomStatus.ENDED) {
      throw new BadRequestException('This video session has already ended');
    }

    // Transition WAITING → ACTIVE on first join
    if (room.status === RoomStatus.WAITING) {
      room.status = RoomStatus.ACTIVE;
      room.startedAt = new Date();
      await this.roomRepo.save(room);

      this.publishEvent('VideoSessionStarted', {
        roomId: room.id,
        calendarSessionId: room.calendarSessionId,
        startedAt: room.startedAt,
        startedBy: userId,
      });
    }

    // Generate a scoped access token valid for TOKEN_TTL_MINUTES
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
    const accessToken = this.tokenRepo.create({
      roomId: room.id,
      userId,
      userRole,
      token: uuidv4(),
      expiresAt,
      used: false,
    });
    const savedToken = await this.tokenRepo.save(accessToken);

    return {
      accessToken: savedToken.token,
      roomToken: room.roomToken,
      status: room.status,
    };
  }

  /**
   * Record the presence of a participant (join + optional leave timestamp).
   * VID-BR-006: presence data feeds the pedagogical log after session close.
   *
   * Publishes: AttendanceRecorded.
   */
  async recordAttendance(
    id: string,
    userId: string,
    userRole: string,
    dto: RecordAttendanceDto,
  ): Promise<AttendanceRecord> {
    if (!ALLOWED_PARTICIPANT_ROLES.includes(userRole)) {
      throw new ForbiddenException('Your role cannot have an attendance record in this room');
    }

    const room = await this.findOne(id);
    if (room.status === RoomStatus.ENDED) {
      throw new BadRequestException('Cannot record attendance for an ended session');
    }

    const record = this.attendanceRepo.create({
      roomId: room.id,
      userId,
      userRole,
      joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : new Date(),
      leftAt: dto.leftAt ? new Date(dto.leftAt) : undefined,
    });
    const saved = await this.attendanceRepo.save(record);

    this.publishEvent('AttendanceRecorded', {
      roomId: room.id,
      calendarSessionId: room.calendarSessionId,
      userId,
      userRole,
      joinedAt: saved.joinedAt,
    });

    return saved;
  }

  /**
   * Close a video session.
   * VID-BR-006: publishes VideoSessionEnded which pedagogical-log-service consumes
   * to create a textbook reminder.
   *
   * Publishes: VideoSessionEnded.
   */
  async end(id: string, callerId: string, callerRole: string): Promise<VideoRoom> {
    // Only formateur, RP, AP, TI may close a room
    if (
      callerRole !== UserRole.FORMATEUR &&
      callerRole !== UserRole.RESPONSABLE_PEDAGOGIQUE &&
      callerRole !== UserRole.ANIMATEUR_PEDAGOGIQUE &&
      callerRole !== UserRole.TECHNICIEN_INFORMATIQUE
    ) {
      throw new ForbiddenException('Only a formateur or pedagogical staff can close a room');
    }

    const room = await this.findOne(id);

    if (room.status === RoomStatus.ENDED) {
      throw new BadRequestException('Room is already ended');
    }

    room.status = RoomStatus.ENDED;
    room.endedAt = new Date();
    const saved = await this.roomRepo.save(room);

    // Collect attendance records to enrich the event payload
    const attendanceRecords = await this.attendanceRepo.find({ where: { roomId: room.id } });

    this.publishEvent('VideoSessionEnded', {
      roomId: saved.id,
      calendarSessionId: saved.calendarSessionId,
      startedAt: saved.startedAt,
      endedAt: saved.endedAt,
      endedBy: callerId,
      attendance: attendanceRecords.map((attendanceRecord) => ({
        userId: attendanceRecord.userId,
        userRole: attendanceRecord.userRole,
        joinedAt: attendanceRecord.joinedAt,
        leftAt: attendanceRecord.leftAt,
      })),
    });

    return saved;
  }

  // ─── Event publishing (stub — replace with EventEmitter2 / message bus) ──────

  /**
   * Publish a domain event.
   * Phase 1: events are logged to stdout in JSON.
   * Phase 2: replace with a proper event bus (Redis Pub/Sub, Kafka, etc.).
   */
  private publishEvent(eventType: string, payload: Record<string, unknown>): void {
    this.logger.log(
      JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        payload,
      }),
    );
  }
}

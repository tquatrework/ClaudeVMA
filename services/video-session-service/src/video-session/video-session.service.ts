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
import { VideoRecording } from './entities/video-recording.entity';
import { RecordingComment } from './entities/recording-comment.entity';
import { CourseSummary } from './entities/course-summary.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { DeclareRecordingDto } from './dto/declare-recording.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { PublishSummaryDto } from './dto/publish-summary.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { LiveKitService } from '../livekit/livekit.service';

/** Roles that are authorised to join a video room (VID-RA-001, VID-RA-002, VID-FB-001). */
const ALLOWED_PARTICIPANT_ROLES: string[] = [
  UserRole.ELEVE,
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/** Roles that are authorised to create/close a room, declare a recording (VID-RA-002/003, VID-AC-001). */
const ROOM_MANAGEMENT_ROLES: string[] = [
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/** Roles that are authorised to publish a course summary (VID-AC-002 — TI excluded on purpose). */
const SUMMARY_AUTHOR_ROLES: string[] = [
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

/** How long a generated access token remains valid (in minutes). */
const TOKEN_TTL_MINUTES = 60;

/** How long a declared recording stays downloadable (VID-AC-001). */
const RECORDING_TTL_DAYS = 30;

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
    @InjectRepository(VideoRecording)
    private readonly recordingRepo: Repository<VideoRecording>,
    @InjectRepository(RecordingComment)
    private readonly commentRepo: Repository<RecordingComment>,
    @InjectRepository(CourseSummary)
    private readonly summaryRepo: Repository<CourseSummary>,
    private readonly liveKit: LiveKitService,
  ) {}

  // ─── Room lifecycle ──────────────────────────────────────────────────────────

  /**
   * Create a new video room linked to a calendar activity.
   * VID-FB-003: calendarSessionId is mandatory.
   * VID-BR-004: room is created in WAITING state until first participant joins.
   *
   * Creates a real LiveKit room (chantier calendrier-visio-livekit, point 4,
   * 2026-08-19) — this used to generate a local UUID with nothing behind it.
   *
   * Publishes: VideoRoomCreated (logged to stdout for now; event bus integration is phase 2).
   */
  async create(dto: CreateRoomDto, creatorId: string, creatorRole: string): Promise<VideoRoom> {
    // Only formateur, RP, AP and TI may create rooms
    if (!ROOM_MANAGEMENT_ROLES.includes(creatorRole)) {
      throw new ForbiddenException('Only a formateur or pedagogical staff can create a room');
    }

    const roomToken = uuidv4();
    await this.liveKit.createRoom(roomToken);

    const room = this.roomRepo.create({
      calendarSessionId: dto.calendarSessionId,
      activityId: null,
      roomToken,
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
   * Create a real LiveKit room automatically for a confirmed `cours` activity
   * (chantier calendrier-visio-livekit, point 4, 2026-08-19). Called by the
   * Redis stream consumer when it receives `ActivityConfirmed` for an activity
   * previously projected as `type: "cours"` from `ActivityScheduled`.
   *
   * Idempotent by `activityId` (unique column): a rejoined event for an
   * activity that already has a room returns the existing room untouched
   * rather than creating a second one or calling LiveKit again.
   */
  async createForActivity(activityId: string): Promise<VideoRoom> {
    const existing = await this.roomRepo.findOne({ where: { activityId } });
    if (existing) {
      return existing;
    }

    const roomToken = uuidv4();
    await this.liveKit.createRoom(roomToken);

    const room = this.roomRepo.create({
      calendarSessionId: null,
      activityId,
      roomToken,
      status: RoomStatus.WAITING,
    });
    const saved = await this.roomRepo.save(room);

    this.publishEvent('VideoRoomCreated', {
      roomId: saved.id,
      activityId: saved.activityId,
      createdBy: 'calendar-service:ActivityConfirmed',
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
   * Retrieve room details by the calendar activity it was created for
   * (`GET /video/rooms/by-activity/:activityId`, chantier calendrier-visio-livekit,
   * point 4). `404` when the activity has no room yet — not confirmed, not a
   * "cours", or the calendar-service event has not been consumed yet.
   */
  async findByActivityId(activityId: string): Promise<VideoRoom> {
    const room = await this.roomRepo.findOne({ where: { activityId } });
    if (!room) throw new NotFoundException(`No video room for activity ${activityId}`);
    return room;
  }

  /**
   * Generate a real LiveKit access token allowing an authorised participant to join.
   * VID-BR-005: tokens are created only for allowed roles.
   * VID-FB-001: parent_financeur is explicitly blocked.
   * VID-FB-002: the token is scoped to the requesting user.
   *
   * Contract change (chantier calendrier-visio-livekit, point 4, 2026-08-19):
   * returns `{token, url}` for the LiveKit client SDK, replacing the previous
   * `{accessToken, roomToken, status}` shape built around a fictitious provider.
   * See docs/routes.md, video-session-service section, for the full note.
   *
   * Publishes: VideoSessionStarted when the room transitions from WAITING → ACTIVE.
   */
  async join(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<{ token: string; url: string }> {
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
        activityId: room.activityId,
        startedAt: room.startedAt,
        startedBy: userId,
      });
    }

    const token = await this.liveKit.createAccessToken(room.roomToken, userId, userRole);

    // Audit trail of who requested a join token and when (kept for VID-BR-005
    // traceability; the value stored is the real LiveKit JWT, short-lived).
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
    const accessTokenRecord = this.tokenRepo.create({
      roomId: room.id,
      userId,
      userRole,
      token,
      expiresAt,
      used: false,
    });
    await this.tokenRepo.save(accessTokenRecord);

    return {
      token,
      url: this.liveKit.getPublicUrl(),
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
    if (!ROOM_MANAGEMENT_ROLES.includes(callerRole)) {
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

  // ─── Recordings (VID-AC-001) ───────────────────────────────────────────────

  /**
   * Declare that a recording is available for an ended room. Expires after
   * RECORDING_TTL_DAYS (VID-AC-001). formateur, RP, AP, TI only — parent_financeur
   * and eleve refused.
   *
   * Publishes: VideoRecordingAvailable.
   */
  async declareRecording(
    roomId: string,
    dto: DeclareRecordingDto,
    declaredBy: string,
    declaredByRole: string,
  ): Promise<VideoRecording> {
    if (!ROOM_MANAGEMENT_ROLES.includes(declaredByRole)) {
      throw new ForbiddenException('Only a formateur or pedagogical staff can declare a recording');
    }

    const room = await this.findOne(roomId);
    if (room.status !== RoomStatus.ENDED) {
      throw new BadRequestException('Cannot declare a recording before the session has ended');
    }

    const expiresAt = new Date(Date.now() + RECORDING_TTL_DAYS * 24 * 60 * 60 * 1000);
    const recording = this.recordingRepo.create({
      roomId: room.id,
      declaredBy,
      downloadUrl: dto.downloadUrl ?? null,
      expiresAt,
    });
    const saved = await this.recordingRepo.save(recording);

    this.publishEvent('VideoRecordingAvailable', {
      recordingId: saved.id,
      roomId: room.id,
      declaredBy,
      expiresAt: saved.expiresAt,
    });

    return saved;
  }

  /**
   * List recordings visible for a room. eleve, formateur, RP, AP, TI —
   * parent_financeur refused (VID-FB-001, VID-AC-001).
   */
  async listRecordings(
    roomId: string,
    userId: string,
    userRole: string,
  ): Promise<VideoRecording[]> {
    if (!ALLOWED_PARTICIPANT_ROLES.includes(userRole)) {
      throw new ForbiddenException('Your role cannot access recordings for this room');
    }

    await this.findOne(roomId);
    return this.recordingRepo.find({ where: { roomId } });
  }

  /**
   * Add a timestamped comment on a recording. eleve (only while the recording
   * has not expired), formateur, RP, AP, TI — parent_financeur refused (VID-FB-001).
   */
  async addComment(
    recordingId: string,
    dto: AddCommentDto,
    userId: string,
    userRole: string,
  ): Promise<RecordingComment> {
    if (!ALLOWED_PARTICIPANT_ROLES.includes(userRole)) {
      throw new ForbiddenException('Your role cannot comment on this recording');
    }

    const recording = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!recording) throw new NotFoundException(`Recording ${recordingId} not found`);

    if (userRole === UserRole.ELEVE && recording.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This recording has expired');
    }

    const comment = this.commentRepo.create({
      recordingId: recording.id,
      userId,
      timestampSeconds: dto.timestampSeconds,
      content: dto.content,
    });
    return this.commentRepo.save(comment);
  }

  // ─── Course summary (VID-AC-002) ───────────────────────────────────────────

  /**
   * Publish a permanent course summary. formateur, RP, AP only — eleve, TI and
   * parent_financeur refused (VID-AC-002).
   *
   * Publishes: CourseSummaryPublished.
   */
  async publishSummary(
    roomId: string,
    dto: PublishSummaryDto,
    authorId: string,
    authorRole: string,
  ): Promise<CourseSummary> {
    if (!SUMMARY_AUTHOR_ROLES.includes(authorRole)) {
      throw new ForbiddenException('Your role cannot publish a course summary');
    }

    const room = await this.findOne(roomId);

    const summary = this.summaryRepo.create({
      roomId: room.id,
      authorId,
      content: dto.content,
      isPermanent: true,
      publishedAt: new Date(),
    });
    const saved = await this.summaryRepo.save(summary);

    this.publishEvent('CourseSummaryPublished', {
      summaryId: saved.id,
      roomId: room.id,
      authorId,
      publishedAt: saved.publishedAt,
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

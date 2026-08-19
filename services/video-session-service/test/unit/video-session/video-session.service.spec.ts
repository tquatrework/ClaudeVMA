import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { VideoSessionService } from '../../../src/video-session/video-session.service';
import { VideoRoom, RoomStatus } from '../../../src/video-session/entities/video-room.entity';
import { VideoAccessToken } from '../../../src/video-session/entities/video-access-token.entity';
import { AttendanceRecord } from '../../../src/video-session/entities/attendance-record.entity';
import { VideoRecording } from '../../../src/video-session/entities/video-recording.entity';
import { RecordingComment } from '../../../src/video-session/entities/recording-comment.entity';
import { CourseSummary } from '../../../src/video-session/entities/course-summary.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { LiveKitService } from '../../../src/livekit/livekit.service';
import { ProfileClientService } from '../../../src/profile/profile-client.service';

// ─── Repository mocks ─────────────────────────────────────────────────────────

const mockRoomRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockTokenRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockAttendanceRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockRecordingRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockCommentRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockSummaryRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockLiveKitService = {
  createRoom: jest.fn(),
  createAccessToken: jest.fn(),
  getPublicUrl: jest.fn(),
};

const mockProfileClientService = {
  resolveDisplayName: jest.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRoom(overrides: Partial<VideoRoom> = {}): VideoRoom {
  return {
    id: 'room-uuid-1',
    calendarSessionId: 'cal-uuid-1',
    activityId: null,
    roomToken: 'room-token-abc',
    status: RoomStatus.WAITING,
    startedAt: null as unknown as Date,
    endedAt: null as unknown as Date,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildRecording(overrides: Partial<VideoRecording> = {}): VideoRecording {
  return {
    id: 'recording-uuid-1',
    roomId: 'room-uuid-1',
    room: buildRoom({ status: RoomStatus.ENDED }),
    declaredBy: 'formateur-1',
    downloadUrl: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VideoSessionService', () => {
  let service: VideoSessionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoSessionService,
        { provide: getRepositoryToken(VideoRoom), useValue: mockRoomRepo },
        { provide: getRepositoryToken(VideoAccessToken), useValue: mockTokenRepo },
        { provide: getRepositoryToken(AttendanceRecord), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(VideoRecording), useValue: mockRecordingRepo },
        { provide: getRepositoryToken(RecordingComment), useValue: mockCommentRepo },
        { provide: getRepositoryToken(CourseSummary), useValue: mockSummaryRepo },
        { provide: LiveKitService, useValue: mockLiveKitService },
        { provide: ProfileClientService, useValue: mockProfileClientService },
      ],
    }).compile();

    service = module.get<VideoSessionService>(VideoSessionService);

    mockLiveKitService.createRoom.mockResolvedValue(undefined);
    mockLiveKitService.createAccessToken.mockResolvedValue('livekit-jwt-abc');
    mockLiveKitService.getPublicUrl.mockReturnValue('https://livekit.example.com');
    mockProfileClientService.resolveDisplayName.mockResolvedValue(null);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a room when caller is formateur', async () => {
      const room = buildRoom();
      mockRoomRepo.create.mockReturnValue(room);
      mockRoomRepo.save.mockResolvedValue(room);

      const result = await service.create(
        { calendarSessionId: 'cal-uuid-1' },
        'user-1',
        UserRole.FORMATEUR,
      );

      expect(mockRoomRepo.save).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(RoomStatus.WAITING);
    });

    it('creates a room when caller is responsable_pedagogique', async () => {
      const room = buildRoom();
      mockRoomRepo.create.mockReturnValue(room);
      mockRoomRepo.save.mockResolvedValue(room);

      await expect(
        service.create({ calendarSessionId: 'cal-uuid-1' }, 'rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when caller is eleve', async () => {
      await expect(
        service.create({ calendarSessionId: 'cal-uuid-1' }, 'eleve-1', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller is parent_financeur', async () => {
      await expect(
        service.create({ calendarSessionId: 'cal-uuid-1' }, 'parent-1', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates a real LiveKit room via LiveKitService.createRoom', async () => {
      const room = buildRoom();
      mockRoomRepo.create.mockReturnValue(room);
      mockRoomRepo.save.mockResolvedValue(room);

      await service.create({ calendarSessionId: 'cal-uuid-1' }, 'user-1', UserRole.FORMATEUR);

      expect(mockLiveKitService.createRoom).toHaveBeenCalledTimes(1);
    });

    it('propagates ServiceUnavailableException when LiveKit is unreachable', async () => {
      mockLiveKitService.createRoom.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        service.create({ calendarSessionId: 'cal-uuid-1' }, 'user-1', UserRole.FORMATEUR),
      ).rejects.toThrow();
      expect(mockRoomRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── createForActivity — chantier calendrier-visio-livekit, point 4 ─────────

  describe('createForActivity()', () => {
    it('creates a room linked to activityId when none exists yet', async () => {
      mockRoomRepo.findOne.mockResolvedValueOnce(null);
      const room = buildRoom({ activityId: 'activity-uuid-1', calendarSessionId: null });
      mockRoomRepo.create.mockReturnValue(room);
      mockRoomRepo.save.mockResolvedValue(room);

      const result = await service.createForActivity('activity-uuid-1');

      expect(mockLiveKitService.createRoom).toHaveBeenCalledTimes(1);
      expect(mockRoomRepo.save).toHaveBeenCalledTimes(1);
      expect(result.activityId).toBe('activity-uuid-1');
    });

    it('is idempotent: returns the existing room without creating a new LiveKit room', async () => {
      const existing = buildRoom({ activityId: 'activity-uuid-1', calendarSessionId: null });
      mockRoomRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.createForActivity('activity-uuid-1');

      expect(mockLiveKitService.createRoom).not.toHaveBeenCalled();
      expect(mockRoomRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  // ── findByActivityId ────────────────────────────────────────────────────────

  describe('findByActivityId()', () => {
    it('returns the room when it exists', async () => {
      const room = buildRoom({ activityId: 'activity-uuid-1' });
      mockRoomRepo.findOne.mockResolvedValue(room);

      const result = await service.findByActivityId('activity-uuid-1');
      expect(result.activityId).toBe('activity-uuid-1');
    });

    it('throws NotFoundException when no room exists for this activity', async () => {
      mockRoomRepo.findOne.mockResolvedValue(null);

      await expect(service.findByActivityId('activity-uuid-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── join — VID-BR-005 ────────────────────────────────────────────────────

  describe('join() — VID-BR-005: only authorised participants obtain a token', () => {
    beforeEach(() => {
      const room = buildRoom({ status: RoomStatus.WAITING });
      mockRoomRepo.findOne.mockResolvedValue(room);
      mockRoomRepo.save.mockResolvedValue({ ...room, status: RoomStatus.ACTIVE, startedAt: new Date() });
    });

    it('generates a real LiveKit token + url for an eleve', async () => {
      const token = {
        id: 'token-uuid',
        roomId: 'room-uuid-1',
        userId: 'eleve-1',
        userRole: UserRole.ELEVE,
        token: 'access-token-abc',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        createdAt: new Date(),
      };
      mockTokenRepo.create.mockReturnValue(token);
      mockTokenRepo.save.mockResolvedValue(token);
      mockLiveKitService.createAccessToken.mockResolvedValue('access-token-abc');
      mockLiveKitService.getPublicUrl.mockReturnValue('https://livekit.example.com');

      const result = await service.join('room-uuid-1', 'eleve-1', UserRole.ELEVE);
      expect(result.token).toBe('access-token-abc');
      expect(result.url).toBe('https://livekit.example.com');
      expect(mockLiveKitService.createAccessToken).toHaveBeenCalledWith(
        'room-token-abc',
        'eleve-1',
        UserRole.ELEVE,
        null,
      );
    });

    // ── Bug fix 2026-08-19: resolve a real display name before building the
    // LiveKit token, never let the raw userId leak as a name ─────────────────

    it('resolves the caller display name and passes it to LiveKitService', async () => {
      const token = { token: 'access-token-abc', used: false, createdAt: new Date() };
      mockTokenRepo.create.mockReturnValue(token);
      mockTokenRepo.save.mockResolvedValue(token);
      mockProfileClientService.resolveDisplayName.mockResolvedValue('Camille Durand');

      await service.join('room-uuid-1', 'eleve-1', UserRole.ELEVE);

      expect(mockProfileClientService.resolveDisplayName).toHaveBeenCalledWith('eleve-1');
      expect(mockLiveKitService.createAccessToken).toHaveBeenCalledWith(
        'room-token-abc',
        'eleve-1',
        UserRole.ELEVE,
        'Camille Durand',
      );
    });

    it('still generates a working token when profile-service is unreachable (graceful degradation)', async () => {
      const token = { token: 'livekit-jwt-abc', used: false, createdAt: new Date() };
      mockTokenRepo.create.mockReturnValue(token);
      mockTokenRepo.save.mockResolvedValue(token);
      mockProfileClientService.resolveDisplayName.mockResolvedValue(null);

      const result = await service.join('room-uuid-1', 'eleve-1', UserRole.ELEVE);

      expect(result.token).toBe('livekit-jwt-abc');
      expect(mockLiveKitService.createAccessToken).toHaveBeenCalledWith(
        'room-token-abc',
        'eleve-1',
        UserRole.ELEVE,
        null,
      );
    });

    it('generates a real LiveKit token for a formateur', async () => {
      const token = { token: 'access-token-xyz', used: false, createdAt: new Date() };
      mockTokenRepo.create.mockReturnValue(token);
      mockTokenRepo.save.mockResolvedValue(token);
      mockLiveKitService.createAccessToken.mockResolvedValue('access-token-xyz');

      const result = await service.join('room-uuid-1', 'formateur-1', UserRole.FORMATEUR);
      expect(result.token).toBe('access-token-xyz');
    });

    it('throws ForbiddenException for parent_financeur — VID-FB-001', async () => {
      await expect(
        service.join('room-uuid-1', 'parent-1', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for administrateur_financier', async () => {
      await expect(
        service.join('room-uuid-1', 'admin-fin-1', UserRole.ADMINISTRATEUR_FINANCIER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when room is already ended', async () => {
      mockRoomRepo.findOne.mockResolvedValue(buildRoom({ status: RoomStatus.ENDED }));

      await expect(
        service.join('room-uuid-1', 'eleve-1', UserRole.ELEVE),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when room does not exist', async () => {
      mockRoomRepo.findOne.mockResolvedValue(null);

      await expect(
        service.join('room-uuid-1', 'eleve-1', UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('transitions room from WAITING to ACTIVE on first join', async () => {
      const waitingRoom = buildRoom({ status: RoomStatus.WAITING });
      const activeRoom = { ...waitingRoom, status: RoomStatus.ACTIVE, startedAt: new Date() };
      mockRoomRepo.findOne.mockResolvedValue(waitingRoom);
      mockRoomRepo.save.mockResolvedValue(activeRoom);

      const token = { token: 'tok', used: false, createdAt: new Date() };
      mockTokenRepo.create.mockReturnValue(token);
      mockTokenRepo.save.mockResolvedValue(token);

      await service.join('room-uuid-1', 'formateur-1', UserRole.FORMATEUR);

      expect(mockRoomRepo.save).toHaveBeenCalledTimes(1);
      const savedRoom = mockRoomRepo.save.mock.calls[0][0];
      expect(savedRoom.status).toBe(RoomStatus.ACTIVE);
    });

    it('does not transition room if already ACTIVE (no duplicate save)', async () => {
      const activeRoom = buildRoom({ status: RoomStatus.ACTIVE });
      mockRoomRepo.findOne.mockResolvedValue(activeRoom);

      const token = { token: 'tok', used: false, createdAt: new Date() };
      mockTokenRepo.create.mockReturnValue(token);
      mockTokenRepo.save.mockResolvedValue(token);

      await service.join('room-uuid-1', 'eleve-1', UserRole.ELEVE);

      // Should NOT save the room (no state transition)
      expect(mockRoomRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── recordAttendance ────────────────────────────────────────────────────

  describe('recordAttendance()', () => {
    beforeEach(() => {
      mockRoomRepo.findOne.mockResolvedValue(buildRoom({ status: RoomStatus.ACTIVE }));
    });

    it('creates an attendance record for a formateur', async () => {
      const record: Partial<AttendanceRecord> = {
        id: 'att-uuid',
        roomId: 'room-uuid-1',
        userId: 'formateur-1',
        userRole: UserRole.FORMATEUR,
        joinedAt: new Date(),
        leftAt: undefined,
        createdAt: new Date(),
      };
      mockAttendanceRepo.create.mockReturnValue(record);
      mockAttendanceRepo.save.mockResolvedValue(record);

      const result = await service.recordAttendance(
        'room-uuid-1',
        'formateur-1',
        UserRole.FORMATEUR,
        {},
      );
      expect(result.userId).toBe('formateur-1');
    });

    it('throws ForbiddenException for parent_financeur', async () => {
      await expect(
        service.recordAttendance('room-uuid-1', 'parent-1', UserRole.PARENT_FINANCEUR, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for ended room', async () => {
      mockRoomRepo.findOne.mockResolvedValue(buildRoom({ status: RoomStatus.ENDED }));

      await expect(
        service.recordAttendance('room-uuid-1', 'eleve-1', UserRole.ELEVE, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── end — VID-BR-006 ─────────────────────────────────────────────────────

  describe('end() — VID-BR-006: closing the session publishes VideoSessionEnded', () => {
    it('closes room and publishes VideoSessionEnded event', async () => {
      const activeRoom = buildRoom({ status: RoomStatus.ACTIVE, startedAt: new Date() });
      const endedRoom = { ...activeRoom, status: RoomStatus.ENDED, endedAt: new Date() };
      mockRoomRepo.findOne.mockResolvedValue(activeRoom);
      mockRoomRepo.save.mockResolvedValue(endedRoom);
      mockAttendanceRepo.find.mockResolvedValue([]);

      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      const result = await service.end('room-uuid-1', 'formateur-1', UserRole.FORMATEUR);

      expect(result.status).toBe(RoomStatus.ENDED);
      expect(result.endedAt).toBeDefined();

      // VideoSessionEnded event must have been published (logged)
      const logCalls: string[] = loggerSpy.mock.calls.map((callArgs) => callArgs[0] as string);
      const endedEvent = logCalls.find((logMessage) => {
        try {
          const parsed = JSON.parse(logMessage);
          return parsed.event === 'VideoSessionEnded';
        } catch {
          return false;
        }
      });
      expect(endedEvent).toBeDefined();
    });

    it('throws ForbiddenException when eleve tries to close the room', async () => {
      await expect(
        service.end('room-uuid-1', 'eleve-1', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for parent_financeur', async () => {
      await expect(
        service.end('room-uuid-1', 'parent-1', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when room is already ended', async () => {
      mockRoomRepo.findOne.mockResolvedValue(buildRoom({ status: RoomStatus.ENDED }));

      await expect(
        service.end('room-uuid-1', 'formateur-1', UserRole.FORMATEUR),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes attendance records in VideoSessionEnded payload', async () => {
      const activeRoom = buildRoom({ status: RoomStatus.ACTIVE, startedAt: new Date() });
      const endedRoom = { ...activeRoom, status: RoomStatus.ENDED, endedAt: new Date() };
      mockRoomRepo.findOne.mockResolvedValue(activeRoom);
      mockRoomRepo.save.mockResolvedValue(endedRoom);

      const attendanceRecords: Partial<AttendanceRecord>[] = [
        {
          userId: 'eleve-1',
          userRole: UserRole.ELEVE,
          joinedAt: new Date(),
          leftAt: undefined,
        },
        {
          userId: 'formateur-1',
          userRole: UserRole.FORMATEUR,
          joinedAt: new Date(),
          leftAt: new Date(),
        },
      ];
      mockAttendanceRepo.find.mockResolvedValue(attendanceRecords);

      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      await service.end('room-uuid-1', 'formateur-1', UserRole.FORMATEUR);

      const logCalls: string[] = loggerSpy.mock.calls.map((callArgs) => callArgs[0] as string);
      const endedEventLog = logCalls.find((logMessage) => {
        try {
          return JSON.parse(logMessage).event === 'VideoSessionEnded';
        } catch {
          return false;
        }
      });

      expect(endedEventLog).toBeDefined();
      const parsed = JSON.parse(endedEventLog!);
      expect(parsed.payload.attendance).toHaveLength(2);
      expect(parsed.payload.attendance[0].userId).toBe('eleve-1');
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns a room when it exists', async () => {
      const room = buildRoom();
      mockRoomRepo.findOne.mockResolvedValue(room);
      const result = await service.findOne('room-uuid-1');
      expect(result.id).toBe('room-uuid-1');
    });

    it('throws NotFoundException when room does not exist', async () => {
      mockRoomRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── declareRecording ───────────────────────────────────────────────────────

  describe('declareRecording()', () => {
    const endedRoom = buildRoom({ status: RoomStatus.ENDED });

    beforeEach(() => {
      mockRoomRepo.findOne.mockResolvedValue(endedRoom);
    });

    it('creates a recording for a formateur on an ended room', async () => {
      const recording = buildRecording();
      mockRecordingRepo.create.mockReturnValue(recording);
      mockRecordingRepo.save.mockResolvedValue(recording);

      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      const result = await service.declareRecording(
        'room-uuid-1',
        { downloadUrl: 'https://storage.example.com/video.mp4' },
        'formateur-1',
        UserRole.FORMATEUR,
      );

      expect(result.id).toBe('recording-uuid-1');
      expect(mockRecordingRepo.save).toHaveBeenCalledTimes(1);

      const logCalls: string[] = loggerSpy.mock.calls.map((callArgs) => callArgs[0] as string);
      const videoRecordingEvent = logCalls.find((logMessage) => {
        try {
          return JSON.parse(logMessage).event === 'VideoRecordingAvailable';
        } catch {
          return false;
        }
      });
      expect(videoRecordingEvent).toBeDefined();
    });

    it('allows RP to declare a recording', async () => {
      const recording = buildRecording();
      mockRecordingRepo.create.mockReturnValue(recording);
      mockRecordingRepo.save.mockResolvedValue(recording);
      jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      await expect(
        service.declareRecording('room-uuid-1', {}, 'rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when role is eleve', async () => {
      await expect(
        service.declareRecording('room-uuid-1', {}, 'eleve-1', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when role is parent_financeur', async () => {
      await expect(
        service.declareRecording('room-uuid-1', {}, 'parent-1', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when room does not exist', async () => {
      mockRoomRepo.findOne.mockResolvedValue(null);

      await expect(
        service.declareRecording('room-uuid-1', {}, 'formateur-1', UserRole.FORMATEUR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when room is not ended', async () => {
      mockRoomRepo.findOne.mockResolvedValue(buildRoom({ status: RoomStatus.ACTIVE }));

      await expect(
        service.declareRecording('room-uuid-1', {}, 'formateur-1', UserRole.FORMATEUR),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets expiresAt to 30 days in the future', async () => {
      const before = Date.now();
      const recording = buildRecording();
      mockRecordingRepo.create.mockImplementation((data) => ({ ...recording, ...data }));
      mockRecordingRepo.save.mockImplementation((data) => Promise.resolve(data));
      jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      await service.declareRecording('room-uuid-1', {}, 'formateur-1', UserRole.FORMATEUR);

      const savedData = mockRecordingRepo.save.mock.calls[0][0];
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(savedData.expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDays);
    });
  });

  // ── listRecordings ─────────────────────────────────────────────────────────

  describe('listRecordings()', () => {
    beforeEach(() => {
      mockRoomRepo.findOne.mockResolvedValue(buildRoom({ status: RoomStatus.ENDED }));
    });

    it('returns all recordings for a formateur', async () => {
      const recordings = [buildRecording(), buildRecording({ id: 'recording-uuid-2' })];
      mockRecordingRepo.find.mockResolvedValue(recordings);

      const result = await service.listRecordings('room-uuid-1', 'formateur-1', UserRole.FORMATEUR);
      expect(result).toHaveLength(2);
    });

    it('returns recordings for an eleve', async () => {
      const recordings = [buildRecording()];
      mockRecordingRepo.find.mockResolvedValue(recordings);

      const result = await service.listRecordings('room-uuid-1', 'eleve-1', UserRole.ELEVE);
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException for parent_financeur — VID-FB-001', async () => {
      await expect(
        service.listRecordings('room-uuid-1', 'parent-1', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when room does not exist', async () => {
      mockRoomRepo.findOne.mockResolvedValue(null);

      await expect(
        service.listRecordings('room-uuid-1', 'formateur-1', UserRole.FORMATEUR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addComment ─────────────────────────────────────────────────────────────

  describe('addComment()', () => {
    const activeRecording = buildRecording();
    const expiredRecording = buildRecording({
      expiresAt: new Date(Date.now() - 1000),
    });

    it('adds a comment for a formateur on an active recording', async () => {
      mockRecordingRepo.findOne.mockResolvedValue(activeRecording);
      const comment = {
        id: 'comment-uuid-1',
        recordingId: 'recording-uuid-1',
        userId: 'formateur-1',
        timestampSeconds: 120,
        content: 'Good explanation here',
        createdAt: new Date(),
      };
      mockCommentRepo.create.mockReturnValue(comment);
      mockCommentRepo.save.mockResolvedValue(comment);

      const result = await service.addComment(
        'recording-uuid-1',
        { timestampSeconds: 120, content: 'Good explanation here' },
        'formateur-1',
        UserRole.FORMATEUR,
      );

      expect(result.id).toBe('comment-uuid-1');
      expect(mockCommentRepo.save).toHaveBeenCalledTimes(1);
    });

    it('allows formateur to comment on expired recordings', async () => {
      mockRecordingRepo.findOne.mockResolvedValue(expiredRecording);
      const comment = { id: 'comment-uuid-2', recordingId: 'recording-uuid-1', userId: 'formateur-1', timestampSeconds: 0, content: 'late comment', createdAt: new Date() };
      mockCommentRepo.create.mockReturnValue(comment);
      mockCommentRepo.save.mockResolvedValue(comment);

      await expect(
        service.addComment(
          'recording-uuid-1',
          { timestampSeconds: 0, content: 'late comment' },
          'formateur-1',
          UserRole.FORMATEUR,
        ),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException for parent_financeur — VID-FB-001', async () => {
      await expect(
        service.addComment(
          'recording-uuid-1',
          { timestampSeconds: 0, content: 'test' },
          'parent-1',
          UserRole.PARENT_FINANCEUR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when recording does not exist', async () => {
      mockRecordingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addComment(
          'recording-uuid-1',
          { timestampSeconds: 0, content: 'test' },
          'eleve-1',
          UserRole.ELEVE,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when eleve tries to comment on expired recording', async () => {
      mockRecordingRepo.findOne.mockResolvedValue(expiredRecording);

      await expect(
        service.addComment(
          'recording-uuid-1',
          { timestampSeconds: 0, content: 'test' },
          'eleve-1',
          UserRole.ELEVE,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── publishSummary ─────────────────────────────────────────────────────────

  describe('publishSummary()', () => {
    beforeEach(() => {
      mockRoomRepo.findOne.mockResolvedValue(buildRoom({ status: RoomStatus.ENDED }));
    });

    it('publishes a summary for a formateur', async () => {
      const summary = {
        id: 'summary-uuid-1',
        roomId: 'room-uuid-1',
        authorId: 'formateur-1',
        content: 'Today we covered quadratic equations.',
        isPermanent: true,
        publishedAt: new Date(),
        createdAt: new Date(),
      };
      mockSummaryRepo.create.mockReturnValue(summary);
      mockSummaryRepo.save.mockResolvedValue(summary);
      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      const result = await service.publishSummary(
        'room-uuid-1',
        { content: 'Today we covered quadratic equations.' },
        'formateur-1',
        UserRole.FORMATEUR,
      );

      expect(result.id).toBe('summary-uuid-1');
      expect(result.isPermanent).toBe(true);
      expect(mockSummaryRepo.save).toHaveBeenCalledTimes(1);

      const logCalls: string[] = loggerSpy.mock.calls.map((callArgs) => callArgs[0] as string);
      const summaryEvent = logCalls.find((logMessage) => {
        try {
          return JSON.parse(logMessage).event === 'CourseSummaryPublished';
        } catch {
          return false;
        }
      });
      expect(summaryEvent).toBeDefined();
    });

    it('allows RP to publish a summary', async () => {
      const summary = { id: 'summary-uuid-2', isPermanent: true, publishedAt: new Date(), roomId: 'room-uuid-1', authorId: 'rp-1', content: 'summary', createdAt: new Date() };
      mockSummaryRepo.create.mockReturnValue(summary);
      mockSummaryRepo.save.mockResolvedValue(summary);
      jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      await expect(
        service.publishSummary('room-uuid-1', { content: 'summary' }, 'rp-1', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when role is eleve', async () => {
      await expect(
        service.publishSummary('room-uuid-1', { content: 'test' }, 'eleve-1', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when role is parent_financeur', async () => {
      await expect(
        service.publishSummary('room-uuid-1', { content: 'test' }, 'parent-1', UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when role is TI (TI cannot publish summaries)', async () => {
      await expect(
        service.publishSummary('room-uuid-1', { content: 'test' }, 'ti-1', UserRole.TECHNICIEN_INFORMATIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when room does not exist', async () => {
      mockRoomRepo.findOne.mockResolvedValue(null);

      await expect(
        service.publishSummary('room-uuid-1', { content: 'test' }, 'formateur-1', UserRole.FORMATEUR),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

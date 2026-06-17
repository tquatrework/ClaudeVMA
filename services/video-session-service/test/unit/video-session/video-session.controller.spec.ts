import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { VideoSessionController, RecordingCommentsController } from '../../../src/video-session/video-session.controller';
import { VideoSessionService } from '../../../src/video-session/video-session.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RoomStatus } from '../../../src/video-session/entities/video-room.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { JwtPayload } from '../../../src/common/guards/jwt-auth.guard';

/** Override JwtAuthGuard so unit tests do not need JwtService/ConfigService. */
const mockJwtAuthGuard = {
  canActivate: (_context: ExecutionContext) => true,
};

// ─── Service mock ─────────────────────────────────────────────────────────────

const mockVideoSessionService = {
  create: jest.fn(),
  findOne: jest.fn(),
  join: jest.fn(),
  recordAttendance: jest.fn(),
  end: jest.fn(),
  declareRecording: jest.fn(),
  listRecordings: jest.fn(),
  addComment: jest.fn(),
  publishSummary: jest.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildJwtPayload(sub: string, role: string): JwtPayload {
  return { sub, role, type: 'access', email: `${sub}@test.com`, validationStatus: 'active', jti: `jti-${sub}` };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VideoSessionController', () => {
  let controller: VideoSessionController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoSessionController],
      providers: [
        { provide: VideoSessionService, useValue: mockVideoSessionService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<VideoSessionController>(VideoSessionController);
  });

  // ── createRoom ────────────────────────────────────────────────────────────

  describe('createRoom()', () => {
    it('delegates to service.create with user sub and role', async () => {
      const roomResult = { id: 'room-1', status: RoomStatus.WAITING };
      mockVideoSessionService.create.mockResolvedValue(roomResult);

      const user = buildJwtPayload('formateur-1', UserRole.FORMATEUR);
      const dto = { calendarSessionId: 'cal-1' };

      const result = await controller.createRoom(dto, user);

      expect(mockVideoSessionService.create).toHaveBeenCalledWith(dto, 'formateur-1', UserRole.FORMATEUR);
      expect(result).toBe(roomResult);
    });
  });

  // ── getRoom ───────────────────────────────────────────────────────────────

  describe('getRoom()', () => {
    it('delegates to service.findOne with the room id', async () => {
      const roomResult = { id: 'room-1', status: RoomStatus.ACTIVE };
      mockVideoSessionService.findOne.mockResolvedValue(roomResult);

      const result = await controller.getRoom('room-1');

      expect(mockVideoSessionService.findOne).toHaveBeenCalledWith('room-1');
      expect(result).toBe(roomResult);
    });
  });

  // ── joinRoom ──────────────────────────────────────────────────────────────

  describe('joinRoom()', () => {
    it('delegates to service.join with room id, user sub and role', async () => {
      const joinResult = { accessToken: 'tok', roomToken: 'room-tok', status: RoomStatus.ACTIVE };
      mockVideoSessionService.join.mockResolvedValue(joinResult);

      const user = buildJwtPayload('eleve-1', UserRole.ELEVE);
      const result = await controller.joinRoom('room-1', user);

      expect(mockVideoSessionService.join).toHaveBeenCalledWith('room-1', 'eleve-1', UserRole.ELEVE);
      expect(result).toBe(joinResult);
    });
  });

  // ── recordAttendance ──────────────────────────────────────────────────────

  describe('recordAttendance()', () => {
    it('delegates to service.recordAttendance with room id, user and dto', async () => {
      const attendanceResult = { id: 'att-1', roomId: 'room-1', userId: 'eleve-1' };
      mockVideoSessionService.recordAttendance.mockResolvedValue(attendanceResult);

      const user = buildJwtPayload('eleve-1', UserRole.ELEVE);
      const dto = { joinedAt: new Date().toISOString() };
      const result = await controller.recordAttendance('room-1', dto, user);

      expect(mockVideoSessionService.recordAttendance).toHaveBeenCalledWith(
        'room-1', 'eleve-1', UserRole.ELEVE, dto,
      );
      expect(result).toBe(attendanceResult);
    });
  });

  // ── closeRoom ─────────────────────────────────────────────────────────────

  describe('closeRoom()', () => {
    it('delegates to service.end with room id, user sub and role', async () => {
      const endResult = { id: 'room-1', status: RoomStatus.ENDED, endedAt: new Date() };
      mockVideoSessionService.end.mockResolvedValue(endResult);

      const user = buildJwtPayload('formateur-1', UserRole.FORMATEUR);
      const result = await controller.closeRoom('room-1', user);

      expect(mockVideoSessionService.end).toHaveBeenCalledWith('room-1', 'formateur-1', UserRole.FORMATEUR);
      expect(result).toBe(endResult);
    });
  });

  // ── declareRecording ──────────────────────────────────────────────────────

  describe('declareRecording()', () => {
    it('delegates to service.declareRecording with room id, dto, user sub and role', async () => {
      const recordingResult = { id: 'recording-1', roomId: 'room-1', expiresAt: new Date() };
      mockVideoSessionService.declareRecording.mockResolvedValue(recordingResult);

      const user = buildJwtPayload('formateur-1', UserRole.FORMATEUR);
      const dto = { downloadUrl: 'https://storage.example.com/video.mp4' };
      const result = await controller.declareRecording('room-1', dto, user);

      expect(mockVideoSessionService.declareRecording).toHaveBeenCalledWith(
        'room-1', dto, 'formateur-1', UserRole.FORMATEUR,
      );
      expect(result).toBe(recordingResult);
    });
  });

  // ── listRecordings ────────────────────────────────────────────────────────

  describe('listRecordings()', () => {
    it('delegates to service.listRecordings with room id, user sub and role', async () => {
      const recordingsResult = [{ id: 'recording-1', roomId: 'room-1' }];
      mockVideoSessionService.listRecordings.mockResolvedValue(recordingsResult);

      const user = buildJwtPayload('formateur-1', UserRole.FORMATEUR);
      const result = await controller.listRecordings('room-1', user);

      expect(mockVideoSessionService.listRecordings).toHaveBeenCalledWith(
        'room-1', 'formateur-1', UserRole.FORMATEUR,
      );
      expect(result).toBe(recordingsResult);
    });
  });

  // ── publishSummary ────────────────────────────────────────────────────────

  describe('publishSummary()', () => {
    it('delegates to service.publishSummary with room id, dto, user sub and role', async () => {
      const summaryResult = { id: 'summary-1', roomId: 'room-1', isPermanent: true };
      mockVideoSessionService.publishSummary.mockResolvedValue(summaryResult);

      const user = buildJwtPayload('formateur-1', UserRole.FORMATEUR);
      const dto = { content: 'Lesson recap' };
      const result = await controller.publishSummary('room-1', dto, user);

      expect(mockVideoSessionService.publishSummary).toHaveBeenCalledWith(
        'room-1', dto, 'formateur-1', UserRole.FORMATEUR,
      );
      expect(result).toBe(summaryResult);
    });
  });
});

// ─── RecordingCommentsController ──────────────────────────────────────────────

describe('RecordingCommentsController', () => {
  let controller: RecordingCommentsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordingCommentsController],
      providers: [
        { provide: VideoSessionService, useValue: mockVideoSessionService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<RecordingCommentsController>(RecordingCommentsController);
  });

  // ── addComment ────────────────────────────────────────────────────────────

  describe('addComment()', () => {
    it('delegates to service.addComment with recording id, dto, user sub and role', async () => {
      const commentResult = { id: 'comment-1', recordingId: 'recording-1', userId: 'eleve-1' };
      mockVideoSessionService.addComment.mockResolvedValue(commentResult);

      const user = buildJwtPayload('eleve-1', UserRole.ELEVE);
      const dto = { timestampSeconds: 60, content: 'Clear step here' };
      const result = await controller.addComment('recording-1', dto, user);

      expect(mockVideoSessionService.addComment).toHaveBeenCalledWith(
        'recording-1', dto, 'eleve-1', UserRole.ELEVE,
      );
      expect(result).toBe(commentResult);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { VideoSessionService } from './video-session.service';
import { VideoRoom, RoomStatus } from './entities/video-room.entity';
import { VideoAccessToken } from './entities/video-access-token.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { UserRole } from '../common/enums/user-role.enum';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRoom(overrides: Partial<VideoRoom> = {}): VideoRoom {
  return {
    id: 'room-uuid-1',
    calendarSessionId: 'cal-uuid-1',
    roomToken: 'room-token-abc',
    status: RoomStatus.WAITING,
    startedAt: null as unknown as Date,
    endedAt: null as unknown as Date,
    createdAt: new Date(),
    updatedAt: new Date(),
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
      ],
    }).compile();

    service = module.get<VideoSessionService>(VideoSessionService);
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
  });

  // ── join — VID-BR-005 ────────────────────────────────────────────────────

  describe('join() — VID-BR-005: only authorised participants obtain a token', () => {
    beforeEach(() => {
      const room = buildRoom({ status: RoomStatus.WAITING });
      mockRoomRepo.findOne.mockResolvedValue(room);
      mockRoomRepo.save.mockResolvedValue({ ...room, status: RoomStatus.ACTIVE, startedAt: new Date() });
    });

    it('generates a token for an eleve', async () => {
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

      const result = await service.join('room-uuid-1', 'eleve-1', UserRole.ELEVE);
      expect(result.accessToken).toBe('access-token-abc');
      expect(result.roomToken).toBe('room-token-abc');
    });

    it('generates a token for a formateur', async () => {
      const token = { token: 'access-token-xyz', used: false, createdAt: new Date() };
      mockTokenRepo.create.mockReturnValue(token);
      mockTokenRepo.save.mockResolvedValue(token);

      const result = await service.join('room-uuid-1', 'formateur-1', UserRole.FORMATEUR);
      expect(result.accessToken).toBe('access-token-xyz');
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
});

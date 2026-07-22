import { Test, TestingModule } from '@nestjs/testing';
import { EventRemindersController } from '../../../src/calendar-events/event-reminders.controller';
import { CalendarEventsService } from '../../../src/calendar-events/calendar-events.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { ReminderDelay } from '../../../src/calendar-events/entities/reminder-rule.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';
import { ConfigureReminderDto } from '../../../src/calendar-events/dto/configure-reminder.dto';

const mockCalendarEventsService = {
  configureReminder: jest.fn(),
};

describe('EventRemindersController', () => {
  let controller: EventRemindersController;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [EventRemindersController],
      providers: [
        { provide: CalendarEventsService, useValue: mockCalendarEventsService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = testingModule.get<EventRemindersController>(EventRemindersController);
    jest.clearAllMocks();
  });

  describe('configureReminder', () => {
    const actor: AuthenticatedUser = { id: 'user-3', role: UserRole.ELEVE };
    const configureReminderDto: ConfigureReminderDto = { delay: ReminderDelay.ONE_HOUR };
    const reminderResult = { id: 'rule-1', eventId: 'evt-4', ownerId: 'user-3', delay: ReminderDelay.ONE_HOUR };

    it('calls service.configureReminder with correct arguments and returns the result', async () => {
      mockCalendarEventsService.configureReminder.mockResolvedValue(reminderResult);

      const result = await controller.configureReminder('evt-4', configureReminderDto, actor, undefined);

      expect(mockCalendarEventsService.configureReminder).toHaveBeenCalledWith(
        'evt-4',
        configureReminderDto,
        'user-3',
        UserRole.ELEVE,
        undefined,
      );
      expect(result).toEqual(reminderResult);
    });

    it('propagates correlationId to the service', async () => {
      const correlationId = 'corr-reminder-001';
      mockCalendarEventsService.configureReminder.mockResolvedValue(reminderResult);

      await controller.configureReminder('evt-4', configureReminderDto, actor, correlationId);

      expect(mockCalendarEventsService.configureReminder).toHaveBeenCalledWith(
        'evt-4',
        configureReminderDto,
        'user-3',
        UserRole.ELEVE,
        correlationId,
      );
    });

    it('extracts actor.id and actor.role from the current user', async () => {
      const teacherActor: AuthenticatedUser = { id: 'teacher-99', role: UserRole.FORMATEUR };
      const oneDayReminderDto: ConfigureReminderDto = { delay: ReminderDelay.ONE_DAY };
      mockCalendarEventsService.configureReminder.mockResolvedValue({ delay: ReminderDelay.ONE_DAY });

      await controller.configureReminder('evt-4', oneDayReminderDto, teacherActor, undefined);

      expect(mockCalendarEventsService.configureReminder).toHaveBeenCalledWith(
        'evt-4',
        oneDayReminderDto,
        'teacher-99',
        UserRole.FORMATEUR,
        undefined,
      );
    });
  });
});

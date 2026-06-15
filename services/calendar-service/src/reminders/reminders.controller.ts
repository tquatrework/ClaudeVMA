import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @Roles(
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.FORMATEUR,
    UserRole.ELEVE,
  )
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Create a reminder',
    description:
      'Creates a reminder for a user. ' +
      'CAL-BR-004: RP can create reminders for any user. ' +
      'CAL-BR-010: publishes ReminderCreated event.',
  })
  @ApiResponse({ status: 201, description: 'Reminder created — emits ReminderCreated event' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  createReminder(
    @Body() dto: CreateReminderDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.remindersService.create(dto, req.user.id, correlationId);
  }
}

import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CorrelationId } from '../common/decorators/correlation-id.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { CalendarsService, CalendarBusyFreeResponse } from './calendars.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';
import { GetCalendarBusyQueryDto } from './dto/get-calendar-busy.query.dto';
import { Calendar } from './entities/calendar.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';

/**
 * Rôles autorisés à écrire sur le calendrier de disponibilités d'un
 * `ownerId` — reflète exactement `CalendarsService.assertCanWriteCalendar`
 * (titulaire ou RP/TI), plus les rôles susceptibles d'être eux-mêmes
 * titulaires d'un calendrier de disponibilités (ÉLÈVE, FORMATEUR — CAL-BR-001
 * / CAL-BR-002). `ANIMATEUR_PEDAGOGIQUE` n'a jamais eu de droit d'écriture
 * côté service malgré sa présence passée ici : décorateur trompeur corrigé
 * le 2026-08-18, en même temps que l'ajout de ÉLÈVE, jusqu'ici absent alors
 * que le service l'autorise déjà (il est titulaire) — sans quoi un élève
 * était bloqué en 403 par ce guard avant même d'atteindre `assertCanWriteCalendar`.
 */
const AVAILABILITY_WRITE_ROLES = [
  UserRole.ELEVE,
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

@ApiTags('calendars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendars')
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get(':ownerId')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // accès filtré par ownership/relation dans le service
  @ApiParam({ name: 'ownerId', description: 'User ID whose calendar to read' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiOperation({
    summary: 'Get a user calendar',
    description:
      'Returns the calendar (availability slots + activities). ' +
      'CAL-FB-001: requester must be the owner or hold an internal role (RP, AP, TI, FINANCE_ADMIN). ' +
      'CAL-BR-003: PARENT_FINANCEUR also receives payment schedule entries.',
  })
  @ApiResponse({ status: 200, description: 'Calendar returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getCalendar(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<Calendar & { paymentEntries?: PaymentScheduleEntry[] }> {
    return this.calendarsService.getCalendar(ownerId, actor, correlationId);
  }

  @Get(':ownerId/busy')
  @Roles(UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE, UserRole.ADMINISTRATEUR_FINANCIER) // accès filtré par relation métier dans le service
  @ApiParam({ name: 'ownerId', description: 'User ID whose busy/free calendar to read' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiOperation({
    summary: 'Get a busy/free view of a linked calendar',
    description:
      "Réponse volontairement pauvre : jamais d'id, de titre, de type ni de participants — " +
      'seulement des fenêtres de temps. Accès piloté par la relation métier réelle avec ' +
      "profile-service (titulaire, RP sans condition de lien, ou relation adéquate), jamais " +
      'par une liste de rôles codée en dur. Voir docs/routes.md pour le détail du contrat.',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ownerId, from, to, availableWindows: [{start,end}], unavailableBlocks: [{start,end}], ' +
      'busyBlocks: [{start,end}]}',
  })
  @ApiResponse({ status: 400, description: 'from/to invalides ou to <= from' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: "CAL-FB-004 : aucune relation n'ouvre le busy/free de ce titulaire",
  })
  @ApiResponse({
    status: 503,
    description: 'profile-service injoignable — impossible de vérifier le droit',
  })
  getBusyFree(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Query() query: GetCalendarBusyQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<CalendarBusyFreeResponse> {
    return this.calendarsService.getBusyFree(
      ownerId,
      actor,
      new Date(query.from),
      new Date(query.to),
      correlationId,
    );
  }

  @Put(':ownerId/availability')
  @Roles(...AVAILABILITY_WRITE_ROLES) // accès filtré par ownership/relation dans le service
  @ApiParam({ name: 'ownerId', description: 'User ID whose availability to update' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Update availability slots',
    description:
      'Replaces all availability slots for a user (bulk replace). ' +
      'CAL-BR-001 (student) / CAL-BR-002 (teacher). ' +
      'CAL-FB-001: only owner, RP, or TI can call this endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Availability updated — emits AvailabilityUpdated event' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  updateAvailability(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: UpdateAvailabilityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<Calendar> {
    return this.calendarsService.updateAvailability(ownerId, dto, actor, correlationId);
  }

  @Post(':ownerId/availability-slots')
  @Roles(...AVAILABILITY_WRITE_ROLES) // accès filtré par ownership/relation dans le service
  @ApiParam({ name: 'ownerId', description: 'User ID whose calendar to add a slot to' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Create a single availability slot',
    description:
      'Adds one availability/unavailability slot without touching any other existing slot ' +
      '(unlike the bulk PUT .../availability). ' +
      'CAL-BR-001 (student) / CAL-BR-002 (teacher). ' +
      'CAL-FB-001: only owner, RP, or TI can call this endpoint.',
  })
  @ApiResponse({ status: 201, description: 'Slot created — emits AvailabilityUpdated event' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. endTime <= startTime)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  createAvailabilitySlot(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: CreateAvailabilitySlotDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<AvailabilitySlot> {
    return this.calendarsService.createSlot(ownerId, dto, actor, correlationId);
  }

  @Patch(':ownerId/availability-slots/:slotId')
  @Roles(...AVAILABILITY_WRITE_ROLES) // accès filtré par ownership/relation dans le service
  @ApiParam({ name: 'ownerId', description: 'User ID who owns the calendar' })
  @ApiParam({ name: 'slotId', description: 'Availability slot UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Update a single availability slot',
    description:
      'Resizes (startTime/endTime) and/or changes recurrence, recurrenceEndDate or kind ' +
      'of one existing slot. ' +
      'CAL-FB-001: only owner, RP, or TI can call this endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Slot updated — emits AvailabilityUpdated event' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. endTime <= startTime)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  @ApiResponse({ status: 404, description: 'Slot not found for this owner' })
  updateAvailabilitySlot(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: UpdateAvailabilitySlotDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<AvailabilitySlot> {
    return this.calendarsService.updateSlot(ownerId, slotId, dto, actor, correlationId);
  }

  @Delete(':ownerId/availability-slots/:slotId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...AVAILABILITY_WRITE_ROLES) // accès filtré par ownership/relation dans le service
  @ApiParam({ name: 'ownerId', description: 'User ID who owns the calendar' })
  @ApiParam({ name: 'slotId', description: 'Availability slot UUID' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Delete a single availability slot',
    description:
      'Hard delete — consistent with the bulk PUT .../availability, which already deletes ' +
      'and recreates slots wholesale. ' +
      'CAL-FB-001: only owner, RP, or TI can call this endpoint.',
  })
  @ApiResponse({ status: 204, description: 'Slot deleted — emits AvailabilityUpdated event' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — CAL-FB-001' })
  @ApiResponse({ status: 404, description: 'Slot not found for this owner' })
  deleteAvailabilitySlot(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId?: string,
  ): Promise<void> {
    return this.calendarsService.deleteSlot(ownerId, slotId, actor, correlationId);
  }
}

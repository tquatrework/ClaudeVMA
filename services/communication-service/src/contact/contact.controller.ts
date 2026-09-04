import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ContactService } from './contact.service';
import { ContactRequestService } from './contact-request.service';
import { ContactRequest } from './entities/contact-request.entity';
import { ProfileServiceClient } from './clients/profile-service.client';
import { ContactResponseDto } from './dto/contact-response.dto';
import { ContactRequestResponseDto } from './dto/contact-request-response.dto';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import {
  LoginIdentifierSearchResponseDto,
  NameSearchResponseDto,
  SearchResultDto,
} from './dto/search-result.dto';

/**
 * docs/routes.md — communication-service — Contacts.
 * docs/architecture/contacts-messagerie.md (2026-09-04).
 */
@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly contactRequestService: ContactRequestService,
    private readonly profileServiceClient: ProfileServiceClient,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List my active contacts',
    description: 'Returns every contact currently ACTIVE for the caller (accepted requests and default contacts).',
  })
  @ApiResponse({ status: 200, type: [ContactResponseDto] })
  @ApiResponse({ status: 401 })
  async listContacts(@CurrentUser() actor: AuthenticatedUser): Promise<ContactResponseDto[]> {
    const rows = await this.contactService.listActiveContacts(actor);
    const names = await this.profileServiceClient.getDisplayNames(rows.map((row) => row.counterpartId));
    const namesById = new Map(names.map((name) => [name.userId, name]));
    return rows.map((row) =>
      ContactResponseDto.fromEntity(row.contact, row.counterpartId, namesById.get(row.counterpartId) ?? null),
    );
  }

  @Post(':id/break')
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiOperation({
    summary: 'Break an active contact',
    description:
      'Ends the contact (point 6): a voluntary act by either party, never destructive — the row ' +
      'is kept with status "broken". Idempotent. A contact re-request is always possible afterwards.',
  })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404, description: 'Contact not found for this user' })
  async breakContact(
    @Param('id', ParseUUIDPipe) contactId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ContactResponseDto> {
    const contact = await this.contactService.breakContact(actor, contactId);
    const counterpartId = contact.userAId === actor.id ? contact.userBId : contact.userAId;
    const name = await this.profileServiceClient.getDisplayName(counterpartId);
    return ContactResponseDto.fromEntity(contact, counterpartId, name);
  }

  // -------------------------------------------------------------------------------------
  // Search (point 2, 10, 11)
  // -------------------------------------------------------------------------------------

  @Get('search/by-login-identifier')
  @ApiQuery({ name: 'value', required: true })
  @ApiOperation({
    summary: 'Find a person by exact loginIdentifier',
    description:
      'Composite search: identity-access-service resolves the account, profile-service resolves ' +
      'the display name for confirmation before a request is sent.',
  })
  @ApiResponse({ status: 200, type: LoginIdentifierSearchResponseDto })
  @ApiResponse({ status: 401 })
  async searchByLoginIdentifier(
    @Query('value') value: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<LoginIdentifierSearchResponseDto> {
    if (!value || !value.trim()) throw new BadRequestException('Le paramètre "value" est requis');
    const result = await this.contactRequestService.searchByLoginIdentifier(actor, value.trim());
    return { found: result !== null, result: result ? SearchResultDto.fromResult(result) : null };
  }

  @Get('search/by-name')
  @ApiQuery({ name: 'q', required: true })
  @ApiOperation({
    summary: 'Search people by first/last name',
    description:
      'point 10: zero or exactly one result is a normal outcome, not an anomaly — not every name ' +
      'will be known. loginIdentifier is included on every result for homonym disambiguation.',
  })
  @ApiResponse({ status: 200, type: NameSearchResponseDto })
  @ApiResponse({ status: 401 })
  async searchByName(
    @Query('q') query: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<NameSearchResponseDto> {
    if (!query || !query.trim()) throw new BadRequestException('Le paramètre "q" est requis');
    const results = await this.contactRequestService.searchByName(actor, query.trim());
    return { results: results.map(SearchResultDto.fromResult) };
  }

  // -------------------------------------------------------------------------------------
  // Requests (points 2-3, 7, 9)
  // -------------------------------------------------------------------------------------

  @Get('requests/incoming')
  @ApiOperation({ summary: 'List pending contact requests addressed to me' })
  @ApiResponse({ status: 200, type: [ContactRequestResponseDto] })
  @ApiResponse({ status: 401 })
  async listIncoming(@CurrentUser() actor: AuthenticatedUser): Promise<ContactRequestResponseDto[]> {
    const requests = await this.contactRequestService.listIncoming(actor);
    return this.resolveRequestNames(requests, (request) => request.requesterId);
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'List my sent contact requests (any status)' })
  @ApiResponse({ status: 200, type: [ContactRequestResponseDto] })
  @ApiResponse({ status: 401 })
  async listOutgoing(@CurrentUser() actor: AuthenticatedUser): Promise<ContactRequestResponseDto[]> {
    const requests = await this.contactRequestService.listOutgoing(actor);
    return this.resolveRequestNames(requests, (request) => request.targetId);
  }

  @Post('requests')
  @ApiOperation({
    summary: 'Send a contact request',
    description:
      'Any authenticated user may request any other (point 2) — no automatic acceptance ever ' +
      '(point 3). Subject to the refusal penalty (point 7): 1-month cooldown after a refusal, ' +
      'permanent block at the 3rd cumulative refusal for this directed pair.',
  })
  @ApiResponse({ status: 201, type: ContactRequestResponseDto })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403, description: 'Blocked by the refusal penalty' })
  @ApiResponse({ status: 404, description: 'Target userId unknown' })
  @ApiResponse({ status: 409, description: 'Already in contact, or a pending request already exists' })
  async createRequest(
    @Body() dto: CreateContactRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ContactRequestResponseDto> {
    const request = await this.contactRequestService.createRequest(actor, dto.targetId);
    const name = await this.profileServiceClient.getDisplayName(dto.targetId);
    return ContactRequestResponseDto.fromEntity(request, dto.targetId, name);
  }

  @Post('requests/:id/accept')
  @ApiParam({ name: 'id', description: 'ContactRequest UUID' })
  @ApiOperation({ summary: 'Accept an incoming contact request' })
  @ApiResponse({ status: 200, type: ContactRequestResponseDto })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  @ApiResponse({ status: 409, description: 'Already responded' })
  async acceptRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ContactRequestResponseDto> {
    const request = await this.contactRequestService.acceptRequest(actor, requestId);
    const name = await this.profileServiceClient.getDisplayName(request.requesterId);
    return ContactRequestResponseDto.fromEntity(request, request.requesterId, name);
  }

  @Post('requests/:id/decline')
  @ApiParam({ name: 'id', description: 'ContactRequest UUID' })
  @ApiOperation({ summary: 'Decline an incoming contact request' })
  @ApiResponse({ status: 200, type: ContactRequestResponseDto })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  @ApiResponse({ status: 409, description: 'Already responded' })
  async declineRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ContactRequestResponseDto> {
    const request = await this.contactRequestService.declineRequest(actor, requestId);
    const name = await this.profileServiceClient.getDisplayName(request.requesterId);
    return ContactRequestResponseDto.fromEntity(request, request.requesterId, name);
  }

  private async resolveRequestNames(
    requests: ContactRequest[],
    counterpartIdOf: (request: ContactRequest) => string,
  ): Promise<ContactRequestResponseDto[]> {
    const counterpartIds = requests.map(counterpartIdOf);
    const names = await this.profileServiceClient.getDisplayNames(counterpartIds);
    const namesById = new Map(names.map((name) => [name.userId, name]));
    return requests.map((request) => {
      const counterpartId = counterpartIdOf(request);
      return ContactRequestResponseDto.fromEntity(request, counterpartId, namesById.get(counterpartId) ?? null);
    });
  }
}

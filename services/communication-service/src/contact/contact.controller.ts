import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  ParseUUIDPipe,
  Body,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ContactService } from './contact.service';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { ContactResponseDto } from './dto/contact-response.dto';

/**
 * Public contact routes for the authenticated user.
 *
 * GET    /contacts                  → List authorized contacts (COM-BR-010)
 * POST   /contacts/:id/activate     → Activate a precontact
 * DELETE /contacts/:id              → Remove a non-mandatory contact
 * PATCH  /contacts/:id/visibility   → Toggle visible / hidden
 */
@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({
    summary: 'List authorized contacts',
    description:
      'Returns all active, non-expired contacts authorized for the current user. ' +
      'COM-BR-010: contact list is computed from profile-service business relations, not freely entered.',
  })
  @ApiResponse({ status: 200, description: 'List of authorized contacts', type: [ContactResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listContacts(@CurrentUser() actor: AuthenticatedUser): Promise<ContactResponseDto[]> {
    const contacts = await this.contactService.listContacts(actor.id);
    return contacts.map((contact) => ContactResponseDto.fromEntity(contact));
  }

  @Post(':id/activate')
  @ApiParam({ name: 'id', description: 'ContactPolicy UUID' })
  @ApiOperation({
    summary: 'Activate a precontact',
    description:
      'Transitions a contact from status "precontact" to "active", ' +
      'making it available for messaging.',
  })
  @ApiResponse({ status: 200, description: 'Contact activated', type: ContactResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found for this user' })
  async activateContact(
    @Param('id', ParseUUIDPipe) contactPolicyId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ContactResponseDto> {
    const contact = await this.contactService.activateContact(actor.id, contactPolicyId);
    return ContactResponseDto.fromEntity(contact);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'ContactPolicy UUID' })
  @ApiOperation({
    summary: 'Remove a contact',
    description:
      'Removes a contact from the user\'s authorized list. ' +
      'Only contacts with mandatory: false can be removed. ' +
      'COM-BR-010: mandatory contacts (e.g. administrators, assigned teachers) cannot be deleted.',
  })
  @ApiResponse({ status: 204, description: 'Contact removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Contact is mandatory and cannot be removed' })
  @ApiResponse({ status: 404, description: 'Contact not found for this user' })
  async removeContact(
    @Param('id', ParseUUIDPipe) contactPolicyId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.contactService.removeContact(actor.id, contactPolicyId);
  }

  @Patch(':id/visibility')
  @ApiParam({ name: 'id', description: 'ContactPolicy UUID' })
  @ApiOperation({
    summary: 'Update contact visibility',
    description:
      'Sets the display preference of a contact to "visible" or "hidden". ' +
      'Hidden contacts remain authorized for messaging but are filtered from the default list view.',
  })
  @ApiResponse({ status: 200, description: 'Visibility updated', type: ContactResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid visibility value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found for this user' })
  async updateVisibility(
    @Param('id', ParseUUIDPipe) contactPolicyId: string,
    @Body() updateVisibilityDto: UpdateVisibilityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ContactResponseDto> {
    const contact = await this.contactService.updateVisibility(
      actor.id,
      contactPolicyId,
      updateVisibilityDto.visibility,
    );
    return ContactResponseDto.fromEntity(contact);
  }
}

import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
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
import { ContactService } from './contact.service';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';

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
  @ApiResponse({ status: 200, description: 'List of authorized contacts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  listContacts(@Req() req: any) {
    return this.contactService.listContacts(req.user.id);
  }

  @Post(':id/activate')
  @ApiParam({ name: 'id', description: 'ContactPolicy UUID' })
  @ApiOperation({
    summary: 'Activate a precontact',
    description:
      'Transitions a contact from status "precontact" to "active", ' +
      'making it available for messaging.',
  })
  @ApiResponse({ status: 200, description: 'Contact activated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found for this user' })
  activateContact(@Param('id') contactPolicyId: string, @Req() req: any) {
    return this.contactService.activateContact(req.user.id, contactPolicyId);
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
  async removeContact(@Param('id') contactPolicyId: string, @Req() req: any): Promise<void> {
    await this.contactService.removeContact(req.user.id, contactPolicyId);
  }

  @Patch(':id/visibility')
  @ApiParam({ name: 'id', description: 'ContactPolicy UUID' })
  @ApiOperation({
    summary: 'Update contact visibility',
    description:
      'Sets the display preference of a contact to "visible" or "hidden". ' +
      'Hidden contacts remain authorized for messaging but are filtered from the default list view.',
  })
  @ApiResponse({ status: 200, description: 'Visibility updated' })
  @ApiResponse({ status: 400, description: 'Invalid visibility value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found for this user' })
  updateVisibility(
    @Param('id') contactPolicyId: string,
    @Body() updateVisibilityDto: UpdateVisibilityDto,
    @Req() req: any,
  ) {
    return this.contactService.updateVisibility(
      req.user.id,
      contactPolicyId,
      updateVisibilityDto.visibility,
    );
  }
}

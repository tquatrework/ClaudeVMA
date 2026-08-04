import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { ContactService } from '../contact/contact.service';
import { SyncContactsDto } from '../contact/dto/sync-contacts.dto';

/**
 * Internal API — not exposed via nginx / api-gateway.
 * Protected by X-Internal-Secret header (InternalSecretGuard).
 *
 * Used by orchestration-service to initialize or update
 * the authorized contact list for a user after profile relations are set.
 *
 * COM-BR-010: contacts derive from profile-service business relations.
 */
@ApiExcludeController()
@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly contactService: ContactService) {}

  @Post('sync-contacts')
  @HttpCode(HttpStatus.NO_CONTENT)
  async syncContacts(@Body() dto: SyncContactsDto): Promise<void> {
    await this.contactService.syncContacts(dto);
  }
}

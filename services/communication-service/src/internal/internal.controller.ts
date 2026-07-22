import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ContactService } from '../contact/contact.service';
import { SyncContactsDto } from '../contact/dto/sync-contacts.dto';

/**
 * Internal API — not exposed via nginx / api-gateway.
 * Protected by X-Internal-Secret header.
 *
 * Used by orchestration-service to initialize or update
 * the authorized contact list for a user after profile relations are set.
 *
 * COM-BR-010: contacts derive from profile-service business relations.
 */
@ApiExcludeController()
@Controller('internal')
export class InternalController {
  constructor(
    private readonly contactService: ContactService,
    private readonly config: ConfigService,
  ) {}

  @Post('sync-contacts')
  @HttpCode(HttpStatus.NO_CONTENT)
  async syncContacts(
    @Headers('x-internal-secret') secret: string,
    @Body() dto: SyncContactsDto,
  ): Promise<void> {
    const expected = this.config.getOrThrow<string>('INTERNAL_SECRET');
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    await this.contactService.syncContacts(dto);
  }
}

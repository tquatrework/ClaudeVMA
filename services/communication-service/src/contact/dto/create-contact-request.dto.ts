import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The target is always designated by a concrete userId — the client resolves it first via
 * GET /contacts/search/by-login-identifier or GET /contacts/search/by-name, then confirms and
 * sends this. communication-service never accepts a raw loginIdentifier or free-text name here
 * (that would duplicate the search logic and reopen ambiguity on homonyms).
 */
export class CreateContactRequestDto {
  @ApiProperty({ description: 'userId of the person to request as a contact' })
  @IsUUID()
  targetId: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Contact, ContactOrigin, ContactStatus } from '../entities/contact.entity';

export class DisplayNameDto {
  @ApiPropertyOptional({ nullable: true }) firstName: string | null;
  @ApiPropertyOptional({ nullable: true }) lastName: string | null;
}

/**
 * Explicit response contract for a Contact. Controllers never return the TypeORM entity
 * directly. `counterpartId` is resolved relative to the calling actor (never both userAId and
 * userBId — the caller only cares "who is the other person").
 */
export class ContactResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() counterpartId: string;
  @ApiPropertyOptional({ nullable: true, type: DisplayNameDto }) counterpartName: DisplayNameDto | null;
  @ApiProperty() status: ContactStatus;
  @ApiProperty() origin: ContactOrigin;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ nullable: true }) brokenAt: Date | null;

  static fromEntity(
    contact: Contact,
    counterpartId: string,
    counterpartName: DisplayNameDto | null = null,
  ): ContactResponseDto {
    const dto = new ContactResponseDto();
    dto.id = contact.id;
    dto.counterpartId = counterpartId;
    dto.counterpartName = counterpartName;
    dto.status = contact.status;
    dto.origin = contact.origin;
    dto.createdAt = contact.createdAt;
    dto.brokenAt = contact.brokenAt;
    return dto;
  }
}

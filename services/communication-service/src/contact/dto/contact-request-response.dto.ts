import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactRequest, ContactRequestStatus } from '../entities/contact-request.entity';
import { DisplayNameDto } from './contact-response.dto';

/**
 * Explicit response contract for a ContactRequest. `counterpartId`/`counterpartName` are
 * resolved relative to the calling actor: on an incoming request this is the requester, on an
 * outgoing request this is the target.
 */
export class ContactRequestResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() counterpartId: string;
  @ApiPropertyOptional({ nullable: true, type: DisplayNameDto }) counterpartName: DisplayNameDto | null;
  @ApiProperty() status: ContactRequestStatus;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ nullable: true }) respondedAt: Date | null;

  static fromEntity(
    contactRequest: ContactRequest,
    counterpartId: string,
    counterpartName: DisplayNameDto | null = null,
  ): ContactRequestResponseDto {
    const dto = new ContactRequestResponseDto();
    dto.id = contactRequest.id;
    dto.counterpartId = counterpartId;
    dto.counterpartName = counterpartName;
    dto.status = contactRequest.status;
    dto.createdAt = contactRequest.createdAt;
    dto.respondedAt = contactRequest.respondedAt;
    return dto;
  }
}

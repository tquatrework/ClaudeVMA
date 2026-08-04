import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactPolicy, ContactStatus, ContactVisibility } from '../entities/contact-policy.entity';

/**
 * Explicit response contract for a ContactPolicy. Controllers never return
 * the TypeORM entity directly.
 */
export class ContactResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() contactId: string;
  @ApiPropertyOptional({ nullable: true }) expiresAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) relationType: string | null;
  @ApiProperty() active: boolean;
  @ApiProperty() status: ContactStatus;
  @ApiProperty() mandatory: boolean;
  @ApiProperty() visibility: ContactVisibility;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: ContactPolicy): ContactResponseDto {
    const dto = new ContactResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.contactId = entity.contactId;
    dto.expiresAt = entity.expiresAt;
    dto.relationType = entity.relationType;
    dto.active = entity.active;
    dto.status = entity.status;
    dto.mandatory = entity.mandatory;
    dto.visibility = entity.visibility;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

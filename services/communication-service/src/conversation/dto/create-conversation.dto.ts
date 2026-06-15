import { IsArray, IsOptional, IsString, IsUUID, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  /**
   * List of participant userIds (must include the caller).
   * COM-BR-010: the caller's contact policy will be checked before creation.
   */
  @ApiProperty({
    description: 'List of participant userIds (UUID). Must include at least one other participant.',
    type: [String],
    example: ['uuid-participant-1', 'uuid-participant-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  participantIds: string[];

  @ApiPropertyOptional({ description: 'Optional subject/label for the conversation' })
  @IsOptional()
  @IsString()
  subject?: string;
}

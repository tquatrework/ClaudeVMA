import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'Text content of the message',
    example: 'Bonjour, pouvez-vous m\'expliquer les intégrales ?',
  })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ description: 'Optional attachment reference (URL or document ID)' })
  @IsOptional()
  @IsString()
  attachmentRef?: string;
}

import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty()
  @IsUUID()
  conversationId: string;

  @ApiProperty()
  @IsUUID()
  senderId: string;

  @ApiProperty()
  @IsUUID()
  receiverId: string;

  @ApiProperty({ example: 'Bonjour, pouvez-vous m\'expliquer les intégrales ?' })
  @IsString()
  content: string;
}

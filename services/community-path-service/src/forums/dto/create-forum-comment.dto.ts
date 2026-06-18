import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateForumCommentDto {
  @ApiProperty({ description: 'Contenu du commentaire' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

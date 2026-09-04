import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateForumCharterDto {
  @ApiProperty({ description: 'Texte de la charte de bonne conduite à afficher avant participation' })
  @IsString()
  content: string;
}

import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublishSummaryDto {
  @ApiProperty({ description: 'Text content of the course summary' })
  @IsString()
  content: string;
}

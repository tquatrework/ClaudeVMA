import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCommentDto {
  @ApiProperty({
    description: 'Position in the video at which this comment applies (seconds from start)',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  timestampSeconds: number;

  @ApiProperty({ description: 'Comment text content' })
  @IsString()
  content: string;
}

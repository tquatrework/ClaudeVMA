import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeclareRecordingDto {
  @ApiPropertyOptional({
    description: 'Download URL or storage path for the recording (optional — may be added later)',
  })
  @IsOptional()
  @IsString()
  downloadUrl?: string;
}

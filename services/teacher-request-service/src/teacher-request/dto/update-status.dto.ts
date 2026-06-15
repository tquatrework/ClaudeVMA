import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '../entities/teacher-request.entity';

export class UpdateStatusDto {
  @ApiProperty({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  status: RequestStatus;
}

import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublishSelectedCandidatesDto {
  @ApiProperty({
    description: 'UUIDs of teachers (formateurs) with an accepted proposal to present to the student/financeur',
    type: [String],
    example: ['uuid-teacher-1', 'uuid-teacher-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  teacherIds: string[];
}

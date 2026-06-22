import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateParentLinkRequestDto {
  @ApiProperty({
    description: 'UUID of the student (élève) the parent wants to be linked to. The parent must obtain this ID through out-of-platform means.',
    example: 'e5f6a7b8-0000-0000-0000-000000000001',
  })
  @IsUUID()
  studentId: string;
}

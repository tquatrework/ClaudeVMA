import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsIn } from 'class-validator';

export class CreatePedagogicalCoordinatorLinkDto {
  @ApiProperty({ description: 'UUID of the RP or AP acting as coordinator' })
  @IsUUID()
  coordinatorId: string;

  @ApiProperty({ description: 'UUID of the student being coordinated' })
  @IsUUID()
  studentId: string;

  @ApiProperty({
    description: 'Role of the coordinator',
    enum: ['responsable_pedagogique', 'animateur_pedagogique'],
  })
  @IsIn(['responsable_pedagogique', 'animateur_pedagogique'])
  coordinatorRole: string;
}

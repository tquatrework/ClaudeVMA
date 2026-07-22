import { IsIn, IsUUID } from 'class-validator';

export class LinkCoordinatorDto {
  @IsUUID() coordinatorId: string;
  @IsUUID() studentId: string;
  @IsIn(['responsable_pedagogique', 'animateur_pedagogique'])
  coordinatorRole: string;
}

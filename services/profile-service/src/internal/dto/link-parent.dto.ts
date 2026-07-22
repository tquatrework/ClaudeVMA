import { IsUUID } from 'class-validator';

export class LinkParentDto {
  @IsUUID() studentId: string;
  @IsUUID() financeOwnerId: string;
}

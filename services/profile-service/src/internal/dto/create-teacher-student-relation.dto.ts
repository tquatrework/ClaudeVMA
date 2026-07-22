import { IsOptional, IsUUID } from 'class-validator';

export class CreateTeacherStudentRelationDto {
  @IsUUID() teacherId: string;
  @IsUUID() studentId: string;
  @IsOptional() isPrincipalTeacher?: boolean;
}

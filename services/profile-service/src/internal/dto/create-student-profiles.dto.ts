import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStudentProfilesDto {
  @IsUUID() userId: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() level?: string;
}

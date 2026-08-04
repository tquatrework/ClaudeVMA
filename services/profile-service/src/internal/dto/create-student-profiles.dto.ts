import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateStudentProfilesDto {
  @IsUUID() userId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() level?: string;
}

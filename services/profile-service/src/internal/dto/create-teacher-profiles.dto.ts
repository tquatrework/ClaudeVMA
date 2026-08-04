import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTeacherProfilesDto {
  @IsUUID() userId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsArray() subjects?: string[];
  @IsOptional() @IsArray() levels?: string[];
  @IsOptional() @IsString() bio?: string;
}

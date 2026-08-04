import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTeacherProfilesDto {
  @IsUUID() userId: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsArray() subjects?: string[];
  @IsOptional() @IsArray() levels?: string[];
  @IsOptional() @IsString() bio?: string;
}

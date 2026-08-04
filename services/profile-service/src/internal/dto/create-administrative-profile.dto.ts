import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAdministrativeProfileDto {
  @IsUUID() userId: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
}

import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfileDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'Marie' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String], example: ['maths', 'physique'] })
  @IsOptional()
  @IsArray()
  subjects?: string[];

  @ApiPropertyOptional({ example: 'lycée' })
  @IsOptional()
  @IsString()
  level?: string;
}

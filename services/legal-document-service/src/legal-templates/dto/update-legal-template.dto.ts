import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLegalTemplateDto {
  @ApiPropertyOptional({ description: 'Updated template title' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ description: 'Updated HTML/text content of the template' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}

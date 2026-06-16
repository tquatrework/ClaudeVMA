import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../../common/enums/document-type.enum';

export class CreateLegalTemplateDto {
  @ApiProperty({ description: 'Template title', example: 'Mandat client V2' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Type of document this template generates',
    enum: DocumentType,
    example: DocumentType.MANDAT_CLIENT,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: 'HTML/text content of the template',
    example: '<p>En signant ce mandat, vous autorisez...</p>',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

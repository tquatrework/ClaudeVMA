import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContactVisibility } from '../entities/contact-policy.entity';

export class UpdateVisibilityDto {
  @ApiProperty({
    description: 'Display visibility preference for this contact',
    enum: ['visible', 'hidden'],
    example: 'hidden',
  })
  @IsIn(['visible', 'hidden'])
  visibility: ContactVisibility;
}

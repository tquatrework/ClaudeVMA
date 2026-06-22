import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ValidationDecision {
  VALIDATED = 'validated',
  REJECTED = 'rejected',
}

export class ValidateTeacherPaymentRequestDto {
  @ApiProperty({
    enum: ValidationDecision,
    description: 'Decision of the AF: validated or rejected',
  })
  @IsEnum(ValidationDecision)
  decision: ValidationDecision;

  @ApiPropertyOptional({
    description: 'Rejection reason (required when decision is rejected)',
    example: 'Facture non conforme',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for inter-service tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}

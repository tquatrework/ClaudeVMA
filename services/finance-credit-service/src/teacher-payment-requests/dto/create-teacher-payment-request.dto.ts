import {
  IsString,
  IsInt,
  IsPositive,
  IsOptional,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeacherPaymentRequestDto {
  @ApiProperty({
    description: 'UUID of the funding owner (parent_financeur) whose points will be debited',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  fundingOwnerId: string;

  @ApiPropertyOptional({
    description: 'UUID of the student linked to this payment',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiProperty({
    description: 'Amount in euro cents to request from the funding owner',
    example: 12000,
  })
  @IsInt()
  @IsPositive()
  amountCents: number;

  @ApiProperty({
    description: 'Description of the service rendered',
    example: 'Cours maths — 2h — 15 juin 2026',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  description: string;

  @ApiPropertyOptional({
    description: 'Invoice reference number provided by the teacher',
    example: 'FACT-2026-001',
  })
  @IsOptional()
  @IsString()
  invoiceReference?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate submissions',
    example: 'idem-teacher-1-june-2026',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for inter-service tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}

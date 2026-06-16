import { IsEnum, IsInt, IsPositive, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType } from '../entities/payment.entity';

export class CreatePaymentDto {
  @ApiProperty({
    enum: PaymentType,
    description: 'Type of payment: inscription, abonnement, or versement_ponctuel',
    example: PaymentType.INSCRIPTION,
  })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiProperty({
    description: 'Amount in euro cents (e.g. 9900 = €99.00)',
    example: 9900,
  })
  @IsInt()
  @IsPositive()
  amountCents: number;

  @ApiPropertyOptional({
    description: 'External transaction reference from payment provider',
    example: 'stripe_pi_abc123',
  })
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for inter-service tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}

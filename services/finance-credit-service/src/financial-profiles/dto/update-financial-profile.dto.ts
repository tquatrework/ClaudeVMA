import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/financial-profile.entity';

export class UpdateFinancialProfileDto {
  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Preferred payment method',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'External payment reference (IBAN, PayPal email, etc.)',
    example: 'FR76 3000 1007 9412 3456 7890 185',
  })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({
    description: 'End date of the funding period (ISO 8601)',
    example: '2027-06-30',
  })
  @IsOptional()
  @IsDateString()
  fundingEndDate?: string;
}

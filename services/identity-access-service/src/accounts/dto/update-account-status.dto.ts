import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AccountStatusValue {
  LIMITED = 'limited',
  MEMBER = 'member',
  NON_APPROVED = 'non_approved',
  VALIDATED = 'validated',
  SUSPENDED = 'suspended',
}

export class UpdateAccountStatusDto {
  @ApiProperty({
    enum: AccountStatusValue,
    description:
      'Target account status: limited (compte limité), member (compte membre), ' +
      'non_approved (non approuvé), validated (validé/actif), suspended (suspendu)',
  })
  @IsEnum(AccountStatusValue)
  status: AccountStatusValue;
}

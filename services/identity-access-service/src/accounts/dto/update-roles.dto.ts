import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/entities/user.entity';

export class UpdateRolesDto {
  @ApiProperty({ enum: UserRole, description: 'New role to assign to the account' })
  @IsEnum(UserRole)
  role: UserRole;
}

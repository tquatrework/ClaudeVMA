import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../auth/entities/user.entity';

export class ListAccountsQueryDto {
  @ApiPropertyOptional({ enum: UserRole, description: 'Filtre optionnel par rôle' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

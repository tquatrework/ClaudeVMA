import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token JWT émis lors de la connexion' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

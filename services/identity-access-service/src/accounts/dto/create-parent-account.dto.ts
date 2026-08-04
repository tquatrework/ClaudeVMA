import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateParentAccountDto {
  @ApiProperty({ example: 'parent@example.com', description: 'Parent financeur email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Sophie', description: 'Parent first name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Bernard', description: 'Parent last name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;
}

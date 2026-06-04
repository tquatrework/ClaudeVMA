import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class UserProfileController {
  constructor(private readonly service: UserProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create profile', description: 'Create a profile for an authenticated user' })
  @ApiResponse({ status: 201, description: 'Profile created' })
  create(@Body() dto: CreateProfileDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List profiles', description: 'Returns all user profiles (admin use)' })
  @ApiResponse({ status: 200, description: 'List of profiles' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':userId')
  @ApiParam({ name: 'userId', description: 'UUID of the user' })
  @ApiOperation({ summary: 'Get profile by userId', description: 'Returns a single user profile' })
  @ApiResponse({ status: 200, description: 'Profile found' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  findOne(@Param('userId') userId: string) {
    return this.service.findByUserId(userId);
  }

  @Patch(':userId')
  @ApiParam({ name: 'userId', description: 'UUID of the user' })
  @ApiOperation({ summary: 'Update profile', description: 'Partial update of a user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  update(@Param('userId') userId: string, @Body() dto: UpdateProfileDto) {
    return this.service.update(userId, dto);
  }

  @Delete(':userId')
  @ApiParam({ name: 'userId', description: 'UUID of the user' })
  @ApiOperation({ summary: 'Delete profile', description: 'Remove a user profile permanently' })
  @ApiResponse({ status: 200, description: 'Profile deleted' })
  remove(@Param('userId') userId: string) {
    return this.service.remove(userId);
  }
}

import { Controller, Post, Body, Get, Param, UseGuards, Request, Ip, Headers, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('password-reset/request')
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Initiate a password reset flow. Always returns success to prevent email enumeration. ' +
      'A reset link is sent to the registered email address if it exists.',
  })
  @ApiResponse({ status: 201, description: 'Reset request accepted — email will be sent if address is known' })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Ip() ipAddress: string) {
    return this.authService.requestPasswordReset(dto.email, ipAddress);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login', description: 'Authenticate and receive JWT access + refresh tokens' })
  @ApiResponse({ status: 200, description: 'Login successful — returns access_token, refresh_token and user info' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account' })
  login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Logout', description: 'Revoke the current session — refresh token becomes invalid' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  async logout(@Request() req) {
    await this.authService.logout(req.user.jti);
    return { message: 'Session revoked' };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh token', description: 'Exchange a valid refresh token for a new token pair' })
  @ApiResponse({ status: 200, description: 'New token pair issued' })
  @ApiResponse({ status: 401, description: 'Invalid, expired or revoked refresh token' })
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get current user', description: 'Return the authenticated user identity and validation status' })
  @ApiResponse({ status: 200, description: 'Current user identity' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  me(@Request() req) {
    const currentUser = req.user;
    return {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      validationStatus: currentUser.validationStatus,
      consentSigned: currentUser.consentSigned,
    };
  }
}

// Note: POST /accounts/{id}/access/regenerate is on AccountsController
// to keep account lifecycle management colocated.

import { Controller, Post, Get, Body, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { ConsentRecord } from './entities/consent-record.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('consents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('consents')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Sign a consent',
    description: 'Record a RGPD, CGU or marketing consent for the authenticated user. Once RGPD + CGU are both signed, account status moves to ACTIVE automatically.',
  })
  @ApiResponse({ status: 201, description: 'Consent recorded' })
  @ApiResponse({ status: 409, description: 'Consent of this type already signed' })
  signConsent(
    @Body() dto: CreateConsentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ipAddress: string,
  ): Promise<ConsentRecord> {
    return this.consentsService.signConsent(actor.id, dto, ipAddress);
  }

  @Get()
  @ApiOperation({ summary: 'List my consents', description: 'Return all consents signed by the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of consent records' })
  getMyConsents(@CurrentUser() actor: AuthenticatedUser): Promise<ConsentRecord[]> {
    return this.consentsService.getConsents(actor.id);
  }
}

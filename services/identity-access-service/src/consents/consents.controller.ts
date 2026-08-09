import { Controller, Post, Get, Body, UseGuards, Ip, Param, ParseEnumPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { ConsentStateDto } from './dto/consent-state.dto';
import { ConsentEventDto } from './dto/consent-event.dto';
import { ConsentRecord, ConsentType, WITHDRAWABLE_CONSENTS } from './entities/consent-record.entity';
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
    summary: 'Grant a consent',
    description:
      'Record a RGPD, CGU or marketing consent for the authenticated user. Once RGPD + CGU are both granted, ' +
      'account status moves to ACTIVE automatically. A consent that was withdrawn can be granted again: the ' +
      '409 is raised on the CURRENT state, not on the existence of a past record.',
  })
  @ApiResponse({ status: 201, description: 'Consent granted and appended to the journal' })
  @ApiResponse({ status: 409, description: 'Consent of this type is already granted' })
  signConsent(
    @Body() dto: CreateConsentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ipAddress: string,
  ): Promise<ConsentRecord> {
    return this.consentsService.signConsent(actor.id, dto, ipAddress);
  }

  /**
   * POST et non DELETE : le retrait AJOUTE un événement au journal append-only
   * `consent_records`, il n'efface aucune ressource. Un `DELETE /consents/:type`
   * annoncerait une suppression, exactement ce que la traçabilité RGPD interdit
   * ici (arbitrage du 2026-08-09).
   */
  @Post(':consentType/withdraw')
  @ApiOperation({
    summary: 'Withdraw a consent',
    description:
      'Withdraw a previously granted OPTIONAL consent. Withdrawing appends a `withdrawn` event to the ' +
      'journal — no record is ever deleted or overwritten, so the grant stays provable. Mandatory consents ' +
      '(rgpd, cgu) are refused with 403: revoking them means closing the account, a separate flow. ' +
      'Withdrawing never deactivates the account, since only optional consents can be withdrawn.',
  })
  @ApiParam({
    name: 'consentType',
    enum: ConsentType,
    description: `Consent to withdraw. Withdrawable types: ${WITHDRAWABLE_CONSENTS.join(', ')}.`,
  })
  @ApiResponse({ status: 201, description: 'Withdrawal recorded' })
  @ApiResponse({ status: 400, description: 'Unknown consent type' })
  @ApiResponse({
    status: 403,
    description: 'Mandatory consent (rgpd, cgu): not withdrawable, close the account instead',
  })
  @ApiResponse({ status: 404, description: 'This consent was never granted by the account' })
  @ApiResponse({ status: 409, description: 'This consent is already withdrawn' })
  withdrawConsent(
    @Param('consentType', new ParseEnumPipe(ConsentType)) consentType: ConsentType,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ipAddress: string,
  ): Promise<ConsentRecord> {
    return this.consentsService.withdrawConsent(actor.id, consentType, ipAddress);
  }

  @Get()
  @ApiOperation({
    summary: 'My current consents',
    description:
      'Current state of every consent type for the authenticated user — always one entry per type, ' +
      'including types never granted. Raw journal rows are not exposed here: a screen showing "signed" for a ' +
      'withdrawn consent would be a lie. Use GET /consents/history for the audit trail.',
  })
  @ApiResponse({ status: 200, type: [ConsentStateDto], description: 'Current state of each consent type' })
  getMyConsents(@CurrentUser() actor: AuthenticatedUser): Promise<ConsentStateDto[]> {
    return this.consentsService.getConsentStates(actor.id);
  }

  @Get('history')
  @ApiOperation({
    summary: 'My consent history',
    description:
      'Append-only journal of every consent event (grants and withdrawals), oldest first. Proves what was ' +
      'granted, what was withdrawn, and when. Nothing is ever removed from it.',
  })
  @ApiResponse({ status: 200, type: [ConsentEventDto], description: 'Chronological consent journal' })
  getMyConsentHistory(@CurrentUser() actor: AuthenticatedUser): Promise<ConsentEventDto[]> {
    return this.consentsService.getConsentHistory(actor.id);
  }
}

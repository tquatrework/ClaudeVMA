import {
  Controller,
  Get,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
  ApiExcludeController,
} from '@nestjs/swagger';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { LegalDocumentsService } from '../legal-documents/legal-documents.service';

@ApiExcludeController()
@ApiTags('internal')
@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly legalDocumentsService: LegalDocumentsService) {}

  @Get('check-signature-status/:ownerId')
  @ApiOperation({
    summary: '[INTERNAL] Check signature status for an owner',
    description:
      'Returns whether MANDAT_CLIENT and CONTRAT_FORMATEUR are signed for the given owner. ' +
      'Used by orchestration-service to validate account/teacher onboarding workflows. ' +
      'Protected by X-Internal-Secret header.',
  })
  @ApiParam({ name: 'ownerId', description: 'User ID to check signature status for' })
  @ApiHeader({ name: 'x-internal-secret', required: true, description: 'Internal service secret' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiResponse({
    status: 200,
    description: 'Signature status returned',
    schema: {
      example: {
        ownerId: 'uuid',
        mandatClientSigne: true,
        contratFormateurSigne: false,
        documents: [
          { documentType: 'MANDAT_CLIENT', status: 'SIGNE', signedAt: '2026-06-16T10:00:00Z' },
          { documentType: 'CONTRAT_FORMATEUR', status: 'A_SIGNER' },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing X-Internal-Secret' })
  checkSignatureStatus(
    @Param('ownerId') ownerId: string,
    @Headers('x-correlation-id') _correlationId?: string,
  ) {
    return this.legalDocumentsService.checkSignatureStatus(ownerId);
  }
}

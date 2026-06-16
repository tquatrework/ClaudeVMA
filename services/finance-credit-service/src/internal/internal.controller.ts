import {
  Controller,
  Post,
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
import { PaymentsService } from '../payments/payments.service';

/**
 * Internal routes — not exposed via nginx, not included in public Swagger.
 * Protected by X-Internal-Secret header.
 * Used by orchestration-service and legal-document-service to check payment status.
 */
@ApiExcludeController()
@ApiTags('internal')
@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('check-payment-status/:ownerId')
  @ApiParam({ name: 'ownerId', description: 'UUID of the funding owner' })
  @ApiHeader({ name: 'x-internal-secret', required: true, description: 'Inter-service secret' })
  @ApiOperation({
    summary: '[Internal] Check inscription payment status',
    description:
      'Returns whether the specified owner has a confirmed inscription payment. ' +
      'Used by legal-document-service and orchestration-service to condition account activation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status for the owner',
    schema: {
      type: 'object',
      properties: {
        isPaid: { type: 'boolean' },
        paymentId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing X-Internal-Secret' })
  checkPaymentStatus(
    @Param('ownerId') ownerId: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.paymentsService.checkInscriptionPaid(ownerId);
  }
}

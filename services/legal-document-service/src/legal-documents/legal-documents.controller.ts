import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { LegalDocumentsService } from './legal-documents.service';
import { SignDocumentDto } from './dto/sign-document.dto';

@ApiTags('legal-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legal-documents')
export class LegalDocumentsController {
  constructor(private readonly legalDocumentsService: LegalDocumentsService) {}

  @Get(':ownerId')
  @ApiOperation({
    summary: 'List legal documents for an owner',
    description:
      'Returns all legal documents assigned to the specified owner. ' +
      'LDS-FB-001: Only the document owner or internal roles (RP, TI, AF) may access.',
  })
  @ApiParam({ name: 'ownerId', description: 'User ID whose legal documents to list' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiResponse({ status: 200, description: 'List of legal documents returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — LDS-FB-001' })
  findByOwnerId(
    @Param('ownerId') ownerId: string,
    @Req() req: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ) {
    return this.legalDocumentsService.findByOwnerId(ownerId, req.user.id, req.user.role);
  }

  @Post(':id/sign')
  @ApiOperation({
    summary: 'Sign a legal document',
    description:
      'Signs a legal document with status A_SIGNER, transitioning it to SIGNE. ' +
      'LDS-BR-002: Signature is unique and non-replayable — returns 409 if already signed. ' +
      'LDS-FB-002: Only the document owner can sign it.',
  })
  @ApiParam({ name: 'id', description: 'Legal document ID to sign' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiResponse({ status: 201, description: 'Document signed — signature record created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — LDS-FB-002: only document owner can sign' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict — LDS-BR-002: document already signed, non-replayable',
  })
  signDocument(
    @Param('id') documentId: string,
    @Body() dto: SignDocumentDto,
    @Req() req: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ) {
    const requesterIp: string = req.ip ?? req.connection?.remoteAddress;
    return this.legalDocumentsService.signDocument(
      documentId,
      dto,
      req.user.id,
      req.user.email,
      requesterIp,
    );
  }
}

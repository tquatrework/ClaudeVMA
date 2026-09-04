import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NameSearchResult } from '../clients/profile-service.client';

/**
 * point 2/10/11: loginIdentifier is included in every result — it is the only field this
 * project never allows to be masked (arbitrages du 2026-08-09 et du 2026-08-17) — precisely so
 * the caller can disambiguate homonyms before sending a request.
 */
export class SearchResultDto {
  @ApiProperty() userId: string;
  @ApiPropertyOptional({ nullable: true }) firstName: string | null;
  @ApiPropertyOptional({ nullable: true }) lastName: string | null;
  @ApiPropertyOptional({ nullable: true }) loginIdentifier: string | null;

  static fromResult(result: NameSearchResult): SearchResultDto {
    const dto = new SearchResultDto();
    dto.userId = result.userId;
    dto.firstName = result.firstName;
    dto.lastName = result.lastName;
    dto.loginIdentifier = result.loginIdentifier;
    return dto;
  }
}

export class NameSearchResponseDto {
  @ApiProperty({ type: [SearchResultDto] }) results: SearchResultDto[];
}

export class LoginIdentifierSearchResponseDto {
  @ApiProperty() found: boolean;
  @ApiPropertyOptional({ type: SearchResultDto, nullable: true }) result: SearchResultDto | null;
}

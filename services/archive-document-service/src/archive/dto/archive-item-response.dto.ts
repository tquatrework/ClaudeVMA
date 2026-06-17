import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArchiveItemType } from '../../common/enums/archive-item-type.enum';

/**
 * Représentation publique d'un élément d'archive (lecture seule).
 */
export class ArchiveItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty({ enum: ArchiveItemType })
  itemType: ArchiveItemType;

  @ApiProperty()
  sourceId: string;

  @ApiProperty()
  sourceService: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string;

  @ApiPropertyOptional()
  downloadUrl: string;

  @ApiPropertyOptional()
  score: number;

  @ApiProperty()
  pedagogicalPoints: number;

  @ApiProperty()
  occurredAt: Date;

  @ApiProperty()
  isParentVisible: boolean;

  @ApiProperty()
  createdAt: Date;
}

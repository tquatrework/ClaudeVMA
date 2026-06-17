import { ApiProperty } from '@nestjs/swagger';
import { ArchiveItemType } from '../../common/enums/archive-item-type.enum';

/**
 * Entrée dans la vue calendrier des archives.
 * Regroupe les éléments par date d'occurrence.
 */
export class ArchiveTimelineEntryDto {
  @ApiProperty({ description: 'Date au format YYYY-MM-DD' })
  date: string;

  @ApiProperty({ type: [Object], description: 'Éléments archivés pour cette date' })
  items: {
    id: string;
    itemType: ArchiveItemType;
    title: string;
    sourceId: string;
    sourceService: string;
    score?: number;
    pedagogicalPoints: number;
  }[];
}

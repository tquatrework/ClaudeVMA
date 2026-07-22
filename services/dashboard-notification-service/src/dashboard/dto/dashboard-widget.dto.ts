import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Explicit HTTP response contract for a single dashboard widget reference.
 * Widget data itself is never embedded here — only a reference the
 * frontend uses to fetch the owning service independently (see
 * dashboard.service.ts DASH-FB-001).
 */
export class DashboardWidgetDto {
  @ApiProperty({ description: 'Widget type identifier' })
  type: string;

  @ApiProperty({ description: 'Human readable widget label' })
  label: string;

  @ApiProperty({ description: 'Name of the microservice owning this widget data' })
  ref: string;

  @ApiPropertyOptional({ description: 'Optional business note attached to the widget' })
  note?: string;

  static fromWidget(widget: Record<string, unknown>): DashboardWidgetDto {
    const response = new DashboardWidgetDto();
    response.type = String(widget.type);
    response.label = String(widget.label);
    response.ref = String(widget.ref);
    if (typeof widget.note === 'string') {
      response.note = widget.note;
    }
    return response;
  }
}

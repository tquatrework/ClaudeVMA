import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PaginatedNotificationsResponseDto } from './dto/paginated-notifications-response.dto';
import { DeleteNotificationResponseDto } from './dto/delete-notification-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'List my notifications',
    description: 'Returns paginated notifications for the authenticated user, newest first.',
  })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated notification list', type: PaginatedNotificationsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    const result = await this.service.findByUser(user.id, query);

    const response = new PaginatedNotificationsResponseDto();
    response.data = result.data.map((notification) => NotificationResponseDto.fromEntity(notification));
    response.meta = result.meta;
    return response;
  }

  @Post(':notificationId/read')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a single notification as read. Only the owner can mark their own notifications.',
  })
  @ApiParam({ name: 'notificationId', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read', type: NotificationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Param('notificationId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationResponseDto> {
    const notification = await this.service.markAsRead(id, user.id);
    return NotificationResponseDto.fromEntity(notification);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a notification',
    description: 'Deletes a notification. Only the owner can delete their own notifications.',
  })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification deleted', type: DeleteNotificationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<DeleteNotificationResponseDto> {
    return this.service.remove(id, user.id);
  }
}

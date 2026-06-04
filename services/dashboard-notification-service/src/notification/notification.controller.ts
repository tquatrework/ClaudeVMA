import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification', description: 'Push a notification to a user (called internally by other services)' })
  @ApiResponse({ status: 201, description: 'Notification created' })
  create(@Body() dto: CreateNotificationDto) {
    return this.service.create(dto);
  }

  @Get('user/:userId')
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiOperation({ summary: 'Get notifications for a user', description: 'Returns all notifications for a user, newest first' })
  @ApiResponse({ status: 200, description: 'Notification list' })
  findByUser(@Param('userId') userId: string) {
    return this.service.findByUser(userId);
  }

  @Patch(':id/read')
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(id);
  }

  @Patch('user/:userId/read-all')
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiOperation({ summary: 'Mark all notifications as read', description: 'Marks all unread notifications for a user as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllAsRead(@Param('userId') userId: string) {
    return this.service.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

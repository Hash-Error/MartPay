import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Notification Engine (Push, Email, SMS)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('trigger')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually dispatch warning/alert notification (Admin only)' })
  @ApiResponse({ status: 200, description: 'Notification queued and dispatched according to preferences.' })
  @ApiResponse({ status: 404, description: 'Recipient user not found.' })
  async triggerAdminNotification(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(dto.userId, dto.eventType, dto.message);
  }
}

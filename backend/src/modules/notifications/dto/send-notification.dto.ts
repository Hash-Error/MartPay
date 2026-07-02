import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ example: 'user-uuid-12345', description: 'User ID of recipient' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: 'security_alert',
    description: 'Notification event type: order_created, payment_success, refund, offer, security_alert',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['order_created', 'payment_success', 'refund', 'offer', 'security_alert'], {
    message: 'Event type must be one of: order_created, payment_success, refund, offer, security_alert',
  })
  eventType: string;

  @ApiProperty({ example: 'New login detected from a new device.', description: 'Alert message content text' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

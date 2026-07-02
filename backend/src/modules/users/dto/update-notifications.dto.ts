import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationsDto {
  @ApiPropertyOptional({ example: true, description: 'Enable/disable email receipts and notifications' })
  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Enable/disable push notifications' })
  @IsOptional()
  @IsBoolean()
  pushAlerts?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Enable/disable SMS alerts' })
  @IsOptional()
  @IsBoolean()
  smsAlerts?: boolean;
}

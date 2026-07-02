import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'device-uuid-12345', description: 'Unique device hardware identifier' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({ example: 'iPhone 15 Pro', description: 'Friendly device model name' })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ example: 'apns-token-xyz-987', description: 'Push notifications token' })
  @IsOptional()
  @IsString()
  deviceToken?: string;
}

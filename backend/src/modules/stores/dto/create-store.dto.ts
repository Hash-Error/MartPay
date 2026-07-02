import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({ example: 'MartPay Supermarket Main', description: 'Store name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Store phone number contact' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

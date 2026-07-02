import { IsNumber, IsString, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ example: 18.0, description: 'Global system sales tax rate percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  globalTaxRate?: number;

  @ApiPropertyOptional({ example: 'USD', description: 'System default currency' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: true, description: 'Force mock payment gateway fallbacks' })
  @IsOptional()
  @IsBoolean()
  mockPaymentGateways?: boolean;
}

import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 8.25, description: 'Store sales tax rate percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({ example: 'USD', description: 'Store currency code ISO' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'America/Los_Angeles', description: 'Store timezone ID' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

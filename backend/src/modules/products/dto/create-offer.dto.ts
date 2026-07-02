import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty({ example: 'Summer Special Discount', description: 'Offer title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Buy this week and get extra discount', description: 'Offer description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 25.0, description: 'Discount percentage (0.0 to 100.0)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage: number;

  @ApiProperty({ example: '2026-07-01T00:00:00Z', description: 'Start date of the promotion (ISO 8601)' })
  @IsISO8601()
  startDate: string;

  @ApiProperty({ example: '2026-07-15T23:59:59Z', description: 'End date of the promotion (ISO 8601)' })
  @IsISO8601()
  endDate: string;
}

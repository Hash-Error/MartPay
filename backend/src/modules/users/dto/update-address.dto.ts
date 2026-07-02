import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAddressDto {
  @ApiPropertyOptional({ example: 'Home', description: 'Friendly title for the address' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '123 Main Street', description: 'Street details' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: 'Seattle', description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'WA', description: 'State/Region name' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '98101', description: 'Postal or zip code' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'USA', description: 'Country name' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: false, description: 'Set as default address' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

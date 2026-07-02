import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ example: 'Home', description: 'Friendly title for the address' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '123 Main Street', description: 'Street details' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'Seattle', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'WA', description: 'State/Region name' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '98101', description: 'Postal or zip code' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'USA', description: 'Country name' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiPropertyOptional({ example: false, description: 'Set as default address' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

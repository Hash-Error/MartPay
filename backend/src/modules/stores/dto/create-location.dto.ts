import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ example: '789 Retail Ave', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'San Francisco', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'CA', description: 'State or province' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '94105', description: 'Postal or zip code' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'USA', description: 'Country name' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiPropertyOptional({ example: 37.7749, description: 'GPS Latitude parameter' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -122.4194, description: 'GPS Longitude parameter' })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

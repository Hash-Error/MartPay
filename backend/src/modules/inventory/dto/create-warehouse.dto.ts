import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'Main Logistics Hub Seattle', description: 'Warehouse unique facility name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '456 Warehouse Blvd', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Seattle', description: 'City location' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: '98101', description: 'Postal/Zip code' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'USA', description: 'Country location' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

import { IsArray, ValidateNested, IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BasketItemDto {
  @ApiProperty({ example: '8801097250046', description: 'Product EAN/UPC barcode' })
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @ApiProperty({ example: 2, description: 'Quantity of items to purchase' })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [BasketItemDto], description: 'List of items checked out from cart' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BasketItemDto)
  items: BasketItemDto[];

  @ApiPropertyOptional({ example: 'store-uuid-12345', description: 'Optional store ID context' })
  @IsOptional()
  @IsString()
  storeId?: string;
}

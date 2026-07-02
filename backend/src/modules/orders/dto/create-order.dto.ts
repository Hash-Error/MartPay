import { IsArray, ValidateNested, IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class BasketItemDto {
  @ApiProperty({ example: '123456789012', description: 'Product EAN/UPC barcode' })
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
}

import { IsString, IsNotEmpty, IsNumber, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: '8801097250046', description: 'Unique product barcode UPC/EAN' })
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @ApiProperty({ example: 'Organic Green Tea 500ml', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 2.99, description: 'Product unit price' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 150, description: 'Inventory stock level count' })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 'category-uuid-123', description: 'Parent category ID' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ example: 'Pure organic leaf brewed green tea', description: 'Product description detail' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://images.example.com/products/greentea.jpg', description: 'Product display image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 0.15, description: 'Discount percentage rate (0.0 to 1.0)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  discountRate?: number;
}

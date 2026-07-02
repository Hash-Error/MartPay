import { IsString, IsNumber, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: '8801097250046', description: 'Unique product barcode UPC/EAN' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 'Organic Green Tea 500ml', description: 'Product name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 2.99, description: 'Product unit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 150, description: 'Inventory stock level count' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 'category-uuid-123', description: 'Parent category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

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

import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitializeStockDto {
  @ApiProperty({ example: 'product-uuid-12345', description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 100, description: 'Initial stock level' })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiPropertyOptional({ example: 15, description: 'Stock count threshold below which alerts are triggered' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

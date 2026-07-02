import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordMovementDto {
  @ApiProperty({ example: 'product-uuid-12345', description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 25, description: 'Positive quantity to receive, negative quantity to dispatch' })
  @IsInt()
  quantity: number;

  @ApiProperty({ example: 'RECEIPT', description: 'Movement type (RECEIPT, DISPATCH, ADJUSTMENT, TRANSFER)' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: 'Restock shipment received', description: 'Optional log remarks' })
  @IsOptional()
  @IsString()
  notes?: string;
}

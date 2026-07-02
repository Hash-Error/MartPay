import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 'order-uuid-12345', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'stripe', description: 'Payment provider ("stripe" or "razorpay")' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['stripe', 'razorpay'], { message: 'Provider must be either stripe or razorpay' })
  provider: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency code ISO' })
  @IsOptional()
  @IsString()
  currency?: string;
}

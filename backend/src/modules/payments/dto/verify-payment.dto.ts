import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ example: 'order-uuid-12345', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'pi_3M3J12345', description: 'Stripe Payment Intent ID or Razorpay Payment ID' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiPropertyOptional({ example: 'pay_id_123', description: 'Razorpay Payment ID (passed separately in verification)' })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({
    example: 'd8a8c160a5e8f498c8c5c56d77bd83a655cd29ef773663ab3cd7f8ea6b402be8',
    description: 'Razorpay signature string generated using key_secret',
  })
  @IsOptional()
  @IsString()
  signature?: string;
}

import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiProperty({ example: 'payment-uuid-12345', description: 'Internal Payment ID' })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiPropertyOptional({ example: 10.5, description: 'Refund amount. If blank, triggers full refund.' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}

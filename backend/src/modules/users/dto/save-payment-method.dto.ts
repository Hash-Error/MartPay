import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsCreditCard, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SavePaymentMethodDto {
  @ApiProperty({ example: 'John Doe', description: 'Name printed on card' })
  @IsString()
  @IsNotEmpty()
  cardHolderName: string;

  @ApiProperty({ example: '1111222233334444', description: '16 digit card number' })
  @IsString()
  @IsNotEmpty()
  @IsCreditCard({ message: 'Must be a valid credit card number' })
  cardNumber: string;

  @ApiProperty({ example: 'Visa', description: 'Card issuer network' })
  @IsString()
  @IsNotEmpty()
  cardType: string;

  @ApiProperty({ example: '12/28', description: 'Expiration date (MM/YY)' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 5, { message: 'Expiration date must be formatted as MM/YY' })
  expirationDate: string;

  @ApiPropertyOptional({ example: false, description: 'Set as default payment method' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

import { IsString, IsNotEmpty, IsCreditCard } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayOrderDto {
  @ApiProperty({ example: '1111222233334444', description: 'Mock card number' })
  @IsString()
  @IsNotEmpty()
  @IsCreditCard()
  cardNumberMock: string;

  @ApiProperty({ example: 'mock-provider', description: 'Mock payment gateway provider name' })
  @IsString()
  @IsNotEmpty()
  provider: string;
}

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyExitDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Cryptographically signed JWT QR token issued to the customer after payment',
  })
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @ApiProperty({ example: 'store-uuid-12345', description: 'Store ID where the exit gate scanner is located' })
  @IsString()
  @IsNotEmpty()
  storeId: string;
}

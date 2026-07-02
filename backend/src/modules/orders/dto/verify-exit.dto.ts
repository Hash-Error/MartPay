import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyExitDto {
  @ApiProperty({
    example: 'order-uuid|timestamp|signature-hash-hmac-sha256',
    description: 'Digitally signed QR exit pass token',
  })
  @IsString()
  @IsNotEmpty()
  qrToken: string;
}

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'johndoe', description: 'User username' })
  @IsString()
  @IsNotEmpty()
  username: string;
}

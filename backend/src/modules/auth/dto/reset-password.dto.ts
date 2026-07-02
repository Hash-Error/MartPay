import { IsString, IsNotEmpty, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'johndoe', description: 'User username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP code must be exactly 6 characters' })
  otpCode: string;

  @ApiProperty({ example: 'NewSecurePassword123!', description: 'Minimum 6 character new password' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

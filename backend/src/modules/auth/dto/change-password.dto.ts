import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldSecurePassword123!', description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'NewSecurePassword123!', description: 'Minimum 6 character new password' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

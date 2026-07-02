import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Full name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'johndoe@example.com', description: 'Contact email' })
  @IsOptional()
  @IsEmail({}, { message: 'Must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

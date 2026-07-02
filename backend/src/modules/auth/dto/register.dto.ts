import { IsString, IsNotEmpty, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'johndoe', description: 'Unique username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Minimum 6 character password' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'customer', enum: ['customer', 'gate_staff', 'admin'] })
  @IsOptional()
  @IsString()
  @IsIn(['customer', 'gate_staff', 'admin'])
  role?: string;
}

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignEmployeeDto {
  @ApiProperty({ example: 'user-uuid-12345', description: 'User ID to register as employee' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'role-uuid-67890', description: 'Store role ID to assign' })
  @IsString()
  @IsNotEmpty()
  roleId: string;
}

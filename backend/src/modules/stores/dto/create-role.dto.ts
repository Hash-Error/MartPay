import { IsString, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'STORE_MANAGER', description: 'Store role identifier' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ['read:billing', 'write:catalog', 'verify:exit'],
    description: 'Fine-grained permission tags associated with this role',
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

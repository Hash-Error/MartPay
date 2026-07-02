import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrderStatusDto {
  @ApiProperty({
    example: 'completed_exit',
    description: 'Updated order status: pending, paid, completed_exit, cancelled, returned',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'paid', 'completed_exit', 'cancelled', 'returned'], {
    message: 'Status must be one of: pending, paid, completed_exit, cancelled, returned',
  })
  status: string;
}

import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnOrderDto {
  @ApiPropertyOptional({ example: 'Defective products returned', description: 'Return explanation notes' })
  @IsOptional()
  @IsString()
  reason?: string;
}

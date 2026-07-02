import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RecordMovementDto } from './record-movement.dto';

export class BatchUpdateStockDto {
  @ApiProperty({ type: [RecordMovementDto], description: 'Array of product stock adjustments to apply' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordMovementDto)
  updates: RecordMovementDto[];
}

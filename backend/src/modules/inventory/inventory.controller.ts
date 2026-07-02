import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { InitializeStockDto } from './dto/initialize-stock.dto';
import { RecordMovementDto } from './dto/record-movement.dto';
import { BatchUpdateStockDto } from './dto/batch-update-stock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Inventory & Warehouse Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post('warehouses')
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new logistics warehouse (Admin only)' })
  @ApiResponse({ status: 201, description: 'Warehouse created successfully.' })
  async createWarehouse(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(createWarehouseDto);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'List all active warehouses' })
  @ApiResponse({ status: 200, description: 'Warehouses returned successfully.' })
  async getWarehouses() {
    return this.inventoryService.getWarehouses();
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'List all inventory items running under low stock threshold' })
  @ApiResponse({ status: 200, description: 'Low stock alerts list returned.' })
  async getLowStockItems() {
    return this.inventoryService.getLowStockItems();
  }

  @Get(':warehouseId')
  @ApiOperation({ summary: 'List inventory items registered inside a specific warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse catalog listing returned.' })
  async getInventoryByWarehouse(@Param('warehouseId') warehouseId: string) {
    return this.inventoryService.getInventoryByWarehouse(warehouseId);
  }

  @Post(':warehouseId')
  @Roles('admin')
  @ApiOperation({ summary: 'Initialize stock parameters for a product in a warehouse (Admin only)' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiResponse({ status: 201, description: 'Stock profile initialized.' })
  async initializeStock(
    @Param('warehouseId') warehouseId: string,
    @Body() initializeStockDto: InitializeStockDto,
  ) {
    return this.inventoryService.initializeStock(warehouseId, initializeStockDto);
  }

  @Post(':warehouseId/movement')
  @Roles('admin')
  @ApiOperation({ summary: 'Record single inventory entry receipt or dispatch adjustment (Admin only)' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiResponse({ status: 201, description: 'Stock movement recorded, stock levels updated.' })
  async recordMovement(
    @Param('warehouseId') warehouseId: string,
    @Body() recordMovementDto: RecordMovementDto,
  ) {
    return this.inventoryService.recordMovement(warehouseId, recordMovementDto);
  }

  @Post(':warehouseId/batch')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({ summary: 'Atomically apply multiple product stock adjustments in a single transaction (Admin only)' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Batch movements applied, atomically committed.' })
  @ApiResponse({ status: 400, description: 'Constraint violation or invalid inputs, whole batch rolled back.' })
  async batchUpdate(
    @Param('warehouseId') warehouseId: string,
    @Body() batchUpdateStockDto: BatchUpdateStockDto,
  ) {
    return this.inventoryService.batchUpdate(warehouseId, batchUpdateStockDto);
  }

  @Get(':inventoryItemId/movements')
  @ApiOperation({ summary: 'Retrieve full movement history trail of an inventory item' })
  @ApiParam({ name: 'inventoryItemId', description: 'Inventory Item ID' })
  @ApiResponse({ status: 200, description: 'Movements trail list returned.' })
  async getMovements(@Param('inventoryItemId') inventoryItemId: string) {
    return this.inventoryService.getMovements(inventoryItemId);
  }
}

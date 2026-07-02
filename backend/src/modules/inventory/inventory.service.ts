import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { InitializeStockDto } from './dto/initialize-stock.dto';
import { RecordMovementDto } from './dto/record-movement.dto';
import { BatchUpdateStockDto } from './dto/batch-update-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ----------------------------------------------------
  // WAREHOUSES
  // ----------------------------------------------------

  async createWarehouse(createWarehouseDto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { name: createWarehouseDto.name },
    });
    if (existing) {
      throw new BadRequestException('Warehouse name already registered');
    }

    const warehouse = await this.prisma.warehouse.create({
      data: createWarehouseDto,
    });

    return { status: 'success', data: { warehouse } };
  }

  async getWarehouses() {
    const warehouses = await this.prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    });
    return { status: 'success', data: { warehouses } };
  }

  // ----------------------------------------------------
  // INVENTORY ITEMS & STOCKS
  // ----------------------------------------------------

  async initializeStock(warehouseId: string, initializeStockDto: InitializeStockDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    const product = await this.prisma.product.findUnique({ where: { id: initializeStockDto.productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check duplicate initialization
    const existing = await this.prisma.inventoryItem.findUnique({
      where: {
        productId_warehouseId: {
          productId: initializeStockDto.productId,
          warehouseId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Product inventory already initialized at this warehouse');
    }

    const item = await this.prisma.inventoryItem.create({
      data: {
        warehouseId,
        productId: initializeStockDto.productId,
        stock: initializeStockDto.stock,
        lowStockThreshold: initializeStockDto.lowStockThreshold ?? 10,
      },
      include: {
        product: true,
      },
    });

    // Write initial movement receipt
    await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        quantity: initializeStockDto.stock,
        type: 'RECEIPT',
        notes: 'Initial stock register',
      },
    });

    return { status: 'success', data: { inventoryItem: item } };
  }

  async getInventoryByWarehouse(warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: { warehouseId },
      include: {
        product: true,
      },
      orderBy: { product: { name: 'asc' } },
    });

    return { status: 'success', data: { inventoryItems: items } };
  }

  async getLowStockItems() {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        stock: {
          lte: this.prisma.inventoryItem.fields.lowStockThreshold,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { stock: 'asc' },
    });

    return { status: 'success', data: { lowStockItems: items } };
  }

  // ----------------------------------------------------
  // STOCK MOVEMENTS
  // ----------------------------------------------------

  async recordMovement(warehouseId: string, recordMovementDto: RecordMovementDto) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: {
        productId_warehouseId: {
          productId: recordMovementDto.productId,
          warehouseId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Product inventory item not found at this warehouse');
    }

    const nextStock = item.stock + recordMovementDto.quantity;
    if (nextStock < 0) {
      throw new BadRequestException('Insufficient stock levels for dispatch operation');
    }

    // Update stock and save movement log
    const updatedItem = await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: { stock: nextStock },
    });

    const movement = await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        quantity: recordMovementDto.quantity,
        type: recordMovementDto.type,
        notes: recordMovementDto.notes,
      },
    });

    return { status: 'success', data: { inventoryItem: updatedItem, movement } };
  }

  // ----------------------------------------------------
  // TRANSACTIONAL BATCH STOCK UPDATE
  // ----------------------------------------------------

  async batchUpdate(warehouseId: string, batchUpdateStockDto: BatchUpdateStockDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    const { updates } = batchUpdateStockDto;

    // Run updates atomically inside a database transaction block
    const results = await this.prisma.$transaction(async (tx) => {
      const operationResults: any[] = [];

      for (const update of updates) {
        const item = await tx.inventoryItem.findUnique({
          where: {
            productId_warehouseId: {
              productId: update.productId,
              warehouseId,
            },
          },
        });

        if (!item) {
          throw new NotFoundException(`Inventory item matching product ${update.productId} not found at warehouse`);
        }

        const nextStock = item.stock + update.quantity;
        if (nextStock < 0) {
          throw new BadRequestException(`Insufficient stock levels for product ${item.productId} in batch`);
        }

        // Apply update
        const updated = await tx.inventoryItem.update({
          where: { id: item.id },
          data: { stock: nextStock },
        });

        // Write audit log
        const log = await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            quantity: update.quantity,
            type: update.type,
            notes: update.notes ?? 'Batch updates operation',
          },
        });

        operationResults.push({ inventoryItemId: item.id, nextStock, movement: log });
      }

      return operationResults;
    });

    return {
      status: 'success',
      message: 'Batch adjustments applied successfully',
      data: { results },
    };
  }

  async getMovements(inventoryItemId: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    const movements = await this.prisma.inventoryMovement.findMany({
      where: { inventoryItemId },
      orderBy: { createdAt: 'desc' },
    });

    return { status: 'success', data: { movements } };
  }
}

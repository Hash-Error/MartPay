import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
    warehouse: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    inventoryItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      fields: {
        lowStockThreshold: 'lowStockThreshold',
      },
    },
    inventoryMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  describe('createWarehouse', () => {
    it('should create warehouse successfully', async () => {
      mockPrismaService.warehouse.findUnique.mockResolvedValue(null);
      mockPrismaService.warehouse.create.mockResolvedValue({ id: 'wh-id', name: 'Logistics A' });

      const res = await service.createWarehouse({
        name: 'Logistics A',
        address: '123 Way',
        city: 'Seattle',
        postalCode: '98101',
        country: 'USA',
      });
      expect(res.status).toBe('success');
      expect(res.data.warehouse.name).toBe('Logistics A');
    });

    it('should throw BadRequestException if warehouse name already exists', async () => {
      mockPrismaService.warehouse.findUnique.mockResolvedValue({ id: 'wh-id' });

      await expect(
        service.createWarehouse({
          name: 'Logistics A',
          address: '123 Way',
          city: 'Seattle',
          postalCode: '98101',
          country: 'USA',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordMovement', () => {
    it('should adjust stock counts and write logs', async () => {
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-id',
        stock: 50,
      });
      mockPrismaService.inventoryItem.update.mockResolvedValue({
        id: 'item-id',
        stock: 65,
      });

      const res = await service.recordMovement('wh-id', {
        productId: 'prod-id',
        quantity: 15,
        type: 'RECEIPT',
      });

      expect(res.status).toBe('success');
      expect(res.data.inventoryItem.stock).toBe(65);
      expect(mockPrismaService.inventoryMovement.create).toHaveBeenCalled();
    });

    it('should reject dispatches exceeding stock levels to prevent negatives', async () => {
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-id',
        stock: 10,
      });

      await expect(
        service.recordMovement('wh-id', {
          productId: 'prod-id',
          quantity: -15, // exceeds 10
          type: 'DISPATCH',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('batchUpdate', () => {
    it('should complete atomic adjustments successfully', async () => {
      mockPrismaService.warehouse.findUnique.mockResolvedValue({ id: 'wh-id' });
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-id-1',
        stock: 100,
      });
      mockPrismaService.inventoryItem.update.mockResolvedValue({
        id: 'item-id-1',
        stock: 80,
      });
      mockPrismaService.inventoryMovement.create.mockResolvedValue({ id: 'log-id' });

      const res = await service.batchUpdate('wh-id', {
        updates: [
          { productId: 'prod-1', quantity: -20, type: 'DISPATCH' },
        ],
      });

      expect(res.status).toBe('success');
      expect(res.data.results[0].nextStock).toBe(80);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrismaService = {
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    offer: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  describe('findByBarcode', () => {
    it('should return product from Redis cache if hit', async () => {
      const mockProduct = { id: 'prod-123', barcode: '8801097250046', name: 'Organic Green Tea' };
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockProduct));

      const res = await service.findByBarcode('8801097250046');
      expect(res.status).toBe('success');
      expect(res.source).toBe('cache');
      expect(res.data.product.name).toBe('Organic Green Tea');
      expect(mockPrismaService.product.findUnique).not.toHaveBeenCalled();
    });

    it('should fallback to database query and write back to Redis if cache miss', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const mockProduct = { id: 'prod-123', barcode: '8801097250046', name: 'Organic Green Tea' };
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const res = await service.findByBarcode('8801097250046');
      expect(res.status).toBe('success');
      expect(res.source).toBe('db');
      expect(res.data.product.name).toBe('Organic Green Tea');
      expect(mockPrismaService.product.findUnique).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'product:barcode:8801097250046',
        JSON.stringify(mockProduct),
        3600,
      );
    });

    it('should throw NotFoundException if product does not exist in DB', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findByBarcode('8801097250046')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Product Updates and Cache Invalidation', () => {
    it('should update database row and delete cache entries', async () => {
      const existingProduct = { id: 'prod-123', barcode: '8801097250046', name: 'Organic Green Tea' };
      const updatedProduct = { id: 'prod-123', barcode: '8801097250046', name: 'Organic Green Tea v2' };

      mockPrismaService.product.findUnique.mockResolvedValue(existingProduct);
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const res = await service.update('prod-123', { name: 'Organic Green Tea v2' });
      expect(res.status).toBe('success');
      expect(res.data.product.name).toBe('Organic Green Tea v2');
      
      expect(mockRedisService.del).toHaveBeenCalledWith('product:barcode:8801097250046');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'product:barcode:8801097250046',
        JSON.stringify(updatedProduct),
        3600,
      );
    });
  });
});

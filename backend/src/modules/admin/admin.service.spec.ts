import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrismaService = {
    payment: {
      findMany: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    store: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    storeEmployee: {
      count: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should aggregate metrics successfully', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([
        { amount: 50.0 },
        { amount: 150.0 },
      ]);
      mockPrismaService.product.count.mockResolvedValue(10);
      mockPrismaService.store.count.mockResolvedValue(2);
      mockPrismaService.user.count.mockResolvedValue(5);
      mockPrismaService.storeEmployee.count.mockResolvedValue(3);
      mockPrismaService.inventoryItem.findMany.mockResolvedValue([]);

      const res = await service.getDashboardStats();
      expect(res.status).toBe('success');
      expect(res.data.sales.revenue).toBe(200.0);
      expect(res.data.sales.count).toBe(2);
      expect(res.data.productsCount).toBe(10);
    });
  });

  describe('getSettings', () => {
    it('should return mock parameters if config is empty', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const res = await service.getSettings();
      expect(res.status).toBe('success');
      expect(res.data.settings.globalTaxRate).toBe(18.0);
    });

    it('should load config values stored inside Redis', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify({
        globalTaxRate: 10.0,
        defaultCurrency: 'INR',
        mockPaymentGateways: false,
      }));

      const res = await service.getSettings();
      expect(res.status).toBe('success');
      expect(res.data.settings.globalTaxRate).toBe(10.0);
      expect(res.data.settings.defaultCurrency).toBe('INR');
    });
  });
});

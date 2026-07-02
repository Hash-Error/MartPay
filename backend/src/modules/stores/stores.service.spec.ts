import { Test, TestingModule } from '@nestjs/testing';
import { StoresService } from './stores.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('StoresService', () => {
  let service: StoresService;
  let prisma: PrismaService;

  const mockPrismaService = {
    store: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    storeSetting: {
      upsert: jest.fn(),
    },
    storeLocation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    storeEmployee: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    storeRole: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
    prisma = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create store with settings successfully', async () => {
      mockPrismaService.store.create.mockResolvedValue({
        id: 'store-uuid',
        name: 'Main Mall Store',
        setting: { taxRate: 0.0 },
      });

      const res = await service.create({ name: 'Main Mall Store' });
      expect(res.status).toBe('success');
      expect(res.data.store.name).toBe('Main Mall Store');
      expect(mockPrismaService.store.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return store parameters', async () => {
      mockPrismaService.store.findUnique.mockResolvedValue({ id: 'store-uuid', name: 'Main Mall Store', isActive: true });

      const res = await service.findById('store-uuid');
      expect(res.status).toBe('success');
      expect(res.data.store.id).toBe('store-uuid');
    });

    it('should throw NotFoundException if inactive or missing', async () => {
      mockPrismaService.store.findUnique.mockResolvedValue(null);

      await expect(service.findById('store-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkEmployeePermission', () => {
    it('should grant permission automatically to global admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'admin-id', role: 'admin' });

      const hasPerm = await service.checkEmployeePermission('admin-id', 'store-id', 'manage:store');
      expect(hasPerm).toBe(true);
    });

    it('should check role permissions list for standard store employee', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'employee-id', role: 'gate_staff' });
      mockPrismaService.storeEmployee.findUnique.mockResolvedValue({
        userId: 'employee-id',
        storeId: 'store-id',
        role: {
          permissions: ['verify:exit'],
        },
      });

      const hasVerify = await service.checkEmployeePermission('employee-id', 'store-id', 'verify:exit');
      const hasBilling = await service.checkEmployeePermission('employee-id', 'store-id', 'read:billing');

      expect(hasVerify).toBe(true);
      expect(hasBilling).toBe(false);
    });

    it('should deny permission if user is not employee of store', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'customer-id', role: 'customer' });
      mockPrismaService.storeEmployee.findUnique.mockResolvedValue(null);

      const hasPerm = await service.checkEmployeePermission('customer-id', 'store-id', 'verify:exit');
      expect(hasPerm).toBe(false);
    });
  });
});

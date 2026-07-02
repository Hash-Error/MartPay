import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { JwtService } from '@nestjs/jwt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InvoiceGeneratorService } from './invoice-generator.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let redis: RedisService;
  let jwt: JwtService;
  let audit: AuditLogsService;
  let invoiceGen: InvoiceGeneratorService;
  let notifications: NotificationsService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    warehouse: {
      findFirst: jest.fn(),
    },
    inventoryItem: {
      upsert: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
    },
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockAuditLogsService = {
    logEvent: jest.fn().mockResolvedValue({}),
  };

  const mockInvoiceGeneratorService = {
    generate: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
  };

  const mockNotificationsService = {
    notifyOrderCreated: jest.fn().mockResolvedValue({}),
    notifyPaymentSuccess: jest.fn().mockResolvedValue({}),
    notifyRefund: jest.fn().mockResolvedValue({}),
    notifyOffer: jest.fn().mockResolvedValue({}),
    notifySecurityAlert: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: InvoiceGeneratorService, useValue: mockInvoiceGeneratorService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    jwt = module.get<JwtService>(JwtService);
    audit = module.get<AuditLogsService>(AuditLogsService);
    invoiceGen = module.get<InvoiceGeneratorService>(InvoiceGeneratorService);
    notifications = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should compute discounted totals and save order', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        barcode: '8801097250046',
        name: 'Green Tea',
        price: 3.0,
        discountRate: 0.1, // 10% off -> 2.70
      });
      mockPrismaService.order.create.mockResolvedValue({
        id: 'order-id',
        totalAmount: 5.4,
      });

      const res = await service.create('user-id', {
        items: [
          { barcode: '8801097250046', quantity: 2 },
        ],
      });

      expect(res.status).toBe('success');
      expect(res.data.order.totalAmount).toBe(5.4);
    });

    it('should throw NotFoundException if product barcode does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-id', {
          items: [{ barcode: 'bad-barcode', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateQrCode', () => {
    it('should throw BadRequestException if order is not paid', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', status: 'pending' });

      await expect(service.generateQrCode('order-id')).rejects.toThrow(BadRequestException);
    });

    it('should sign cryptographic JWT for paid orders', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', status: 'paid', storeId: 'store-1' });
      mockJwtService.signAsync.mockResolvedValue('signed-jwt-token');

      const res = await service.generateQrCode('order-id');
      expect(res.status).toBe('success');
      expect(res.data.qrToken).toBe('signed-jwt-token');
    });
  });

  describe('verifyExit', () => {
    it('should decrypt signature, confirm paid status, and log exit', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ orderId: 'order-id', storeId: 'store-1' });
      mockRedisService.get.mockResolvedValue(null); // not replayed
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-id',
        status: 'paid',
        items: [{ barcode: '8801097250046', quantity: 2 }],
        totalAmount: 5.4,
      });

      const res = await service.verifyExit(
        { qrToken: 'valid-token', storeId: 'store-1' },
        'staff-id-1',
      );

      expect(res.status).toBe('success');
      expect(res.data.orderId).toBe('order-id');
      expect(mockRedisService.set).toHaveBeenCalledWith('qr:used:order-id', 'true', 86400);
    });

    it('should block exit if QR code is replayed in Redis', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ orderId: 'order-id', storeId: 'store-1' });
      mockRedisService.get.mockResolvedValue('true'); // replay hit!

      await expect(
        service.verifyExit({ qrToken: 'valid-token', storeId: 'store-1' }, 'staff-id-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel pending order successfully', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', userId: 'user-1', status: 'pending' });
      mockPrismaService.order.update.mockResolvedValue({ id: 'order-id', status: 'cancelled' });

      const res = await service.cancelOrder('order-id', 'user-1');
      expect(res.status).toBe('success');
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-id' },
        data: { status: 'cancelled' },
      });
    });

    it('should throw ForbiddenException if user cancels another user\'s order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', userId: 'user-1', status: 'pending' });

      await expect(service.cancelOrder('order-id', 'user-2')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order is already paid', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', userId: 'user-1', status: 'paid' });

      await expect(service.cancelOrder('order-id', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('processReturn', () => {
    it('should process return and replenish stock in warehouse', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-id',
        status: 'completed_exit',
        storeId: 'store-1',
        items: [{ barcode: '8801097250046', quantity: 3 }],
      });
      mockPrismaService.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', name: 'Store-1 Warehouse' });
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'prod-1', barcode: '8801097250046' });
      mockPrismaService.inventoryItem.upsert.mockResolvedValue({ id: 'inv-item-1' });

      const res = await service.processReturn('order-id', 'staff-1', { reason: 'Damaged item' });
      expect(res.status).toBe('success');
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-id' },
        data: { status: 'returned' },
      });
    });
  });

  describe('getDigitalReceipt', () => {
    it('should return detailed digital receipt for customer', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-id',
        userId: 'user-1',
        status: 'completed_exit',
        storeId: 'store-1',
        totalAmount: 10.0,
        items: [{ barcode: '123', name: 'Item', price: 10.0, quantity: 1 }],
        payments: [{ id: 'p1', provider: 'stripe', transactionId: 'tx-1', amount: 10.0, status: 'success', updatedAt: new Date() }],
        createdAt: new Date(),
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'customer' });
      mockPrismaService.store.findUnique.mockResolvedValue({
        id: 'store-1',
        name: 'SuperMart',
        setting: { taxRate: 10.0, currency: 'USD', timezone: 'EST' },
      });

      const res = await service.getDigitalReceipt('order-id', 'user-1');
      expect(res.status).toBe('success');
      expect(res.data.receipt.storeName).toBe('SuperMart');
    });

    it('should throw ForbiddenException if customer requests another\'s receipt', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'order-id', userId: 'user-1', status: 'completed_exit', payments: [] });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2', role: 'customer' });

      await expect(service.getDigitalReceipt('order-id', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInvoicePdf', () => {
    it('should generate secure PDF invoice file path successfully', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-inv-1',
        userId: 'user-1',
        status: 'paid',
        items: [{ barcode: '123', name: 'Item', price: 10.0, quantity: 1 }],
        payments: [{ id: 'p1', provider: 'stripe', transactionId: 'tx-1', amount: 10.0, status: 'success', updatedAt: new Date() }],
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'customer' });
      mockInvoiceGeneratorService.generate.mockResolvedValue(Buffer.from('mock-pdf-data'));

      const filePath = await service.getInvoicePdf('order-inv-1', 'user-1');
      expect(filePath).toContain('invoice_order-inv-1.pdf');
    });
  });
});

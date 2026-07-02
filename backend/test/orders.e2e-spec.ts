import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('OrdersController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let adminToken: string;
  let staffToken: string;
  let customerToken: string;

  // In-memory mock database
  const ordersDb = new Map<string, any>();
  const productsDb = new Map<string, any>();
  const warehousesDb = new Map<string, any>();
  const inventoryItemsDb = new Map<string, any>();
  const storeDb = new Map<string, any>();
  const redisCacheDb = new Map<string, string>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    product: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(productsDb.get(where.barcode) || null);
      }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const role = where.id === 'admin-1' ? 'admin' : where.id === 'staff-1' ? 'gate_staff' : 'customer';
        return Promise.resolve({ id: where.id, role });
      }),
    },
    warehouse: {
      findFirst: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(warehousesDb.values())[0] || null);
      }),
    },
    inventoryItem: {
      upsert: jest.fn().mockImplementation(({ where, update, create }) => {
        const id = 'inv-item-1';
        const item = { id, productId: create.productId, warehouseId: create.warehouseId, stock: create.stock };
        inventoryItemsDb.set(id, item);
        return Promise.resolve(item);
      }),
    },
    inventoryMovement: {
      create: jest.fn().mockResolvedValue({}),
    },
    store: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(storeDb.get(where.id) || null);
      }),
    },
    order: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `order-${Date.now()}`;
        const order = { id, createdAt: new Date(), payments: [], ...data };
        ordersDb.set(id, order);
        return Promise.resolve(order);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(ordersDb.get(where.id) || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const order = ordersDb.get(where.id);
        if (!order) return Promise.resolve(null);
        const updated = { ...order, ...data };
        ordersDb.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(Array.from(ordersDb.values()).filter((o) => o.userId === where.userId));
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockRedisService = {
    get: jest.fn().mockImplementation((key) => {
      return Promise.resolve(redisCacheDb.get(key) || null);
    }),
    set: jest.fn().mockImplementation((key, val) => {
      redisCacheDb.set(key, val);
      return Promise.resolve();
    }),
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    ordersDb.clear();
    productsDb.clear();
    warehousesDb.clear();
    inventoryItemsDb.clear();
    storeDb.clear();
    redisCacheDb.clear();

    // Seed mock product
    productsDb.set('8801097250046', {
      id: 'prod-1',
      barcode: '8801097250046',
      name: 'Organic Green Tea',
      price: 2.5,
      discountRate: 0.0,
    });

    // Seed mock warehouse
    warehousesDb.set('wh-1', {
      id: 'wh-1',
      name: 'Store-1 Warehouse',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);

    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    // Security tokens
    adminToken = await jwtService.signAsync({ sub: 'admin-1', username: 'adminuser', role: 'admin', sessionId: 'sess-1' });
    staffToken = await jwtService.signAsync({ sub: 'staff-1', username: 'staffuser', role: 'gate_staff', sessionId: 'sess-2' });
    customerToken = await jwtService.signAsync({ sub: 'cust-1', username: 'custuser', role: 'customer', sessionId: 'sess-3' });
  });

  describe('Secure QR Exit Verification E2E Flow', () => {
    it('should complete checkout, retrieve QR, verify exit, and reject replays', async () => {
      // 1. Customer creates shopping order
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [{ barcode: '8801097250046', quantity: 2 }],
          storeId: 'store-uuid-12345',
        })
        .expect(201);

      const orderId = orderRes.body.data.order.id;

      // 2. Mock order as paid
      ordersDb.set(orderId, {
        ...ordersDb.get(orderId),
        status: 'paid',
        qrExpiresAt: new Date(Date.now() + 3600 * 1000),
      });

      // 3. Customer gets secure QR token
      const qrRes = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}/qr`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const qrToken = qrRes.body.data.qrToken;

      // 4. Gate staff scans QR token (successful exit capture)
      await request(app.getHttpServer())
        .post('/api/v1/orders/verify-exit')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          qrToken,
          storeId: 'store-uuid-12345',
        })
        .expect(200);
    });
  });

  describe('Order Operations (Cancel, Return, Receipt, Status)', () => {
    it('should allow customer to cancel pending unpaid orders', async () => {
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [{ barcode: '8801097250046', quantity: 1 }],
        })
        .expect(201);

      const orderId = orderRes.body.data.order.id;

      // Cancel
      const cancelRes = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(cancelRes.body.status).toBe('success');
      expect(ordersDb.get(orderId).status).toBe('cancelled');
    });

    it('should process return, replenish inventory and allow receipt lookups', async () => {
      // 1. Seed paid order
      const orderId = 'order-exit-123';
      ordersDb.set(orderId, {
        id: orderId,
        userId: 'cust-1',
        status: 'completed_exit',
        storeId: 'store-1',
        totalAmount: 5.0,
        items: [{ barcode: '8801097250046', quantity: 2 }],
        payments: [{ id: 'p1', provider: 'stripe', transactionId: 'tx-1', amount: 5.0, status: 'success', updatedAt: new Date() }],
        createdAt: new Date(),
      });

      // 2. Fetch receipt
      const receiptRes = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}/receipt`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(receiptRes.body.status).toBe('success');
      expect(receiptRes.body.data.receipt.billing.finalTotal).toBe(5.0);

      // 3. Process return
      const returnRes = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/return`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          reason: 'Defective green tea packaging',
        })
        .expect(200);

      expect(returnRes.body.status).toBe('success');
      expect(ordersDb.get(orderId).status).toBe('returned');
    });

    it('should allow customer to download PDF tax invoices', async () => {
      const orderId = 'order-invoice-e2e-123';
      ordersDb.set(orderId, {
        id: orderId,
        userId: 'cust-1',
        status: 'paid',
        storeId: 'store-1',
        totalAmount: 5.0,
        items: [{ barcode: '8801097250046', name: 'Organic Green Tea', price: 2.5, quantity: 2 }],
        payments: [{ id: 'p1', provider: 'stripe', transactionId: 'tx-1', amount: 5.0, status: 'success', updatedAt: new Date() }],
        createdAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}/invoice`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });

  afterEach(async () => {
    await app.close();
  });
});

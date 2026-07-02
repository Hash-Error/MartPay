import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('PaymentsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let adminToken: string;
  let customerToken: string;

  // In-memory mock database
  const ordersDb = new Map<string, any>();
  const paymentsDb = new Map<string, any>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    order: {
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
    },
    payment: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(paymentsDb.get(where.id) || null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const list = Array.from(paymentsDb.values());
        const pay = list.find((p) => p.orderId === where.orderId && p.transactionId === where.transactionId && p.status === where.status);
        return Promise.resolve(pay || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `pay-${Date.now()}`;
        const pay = { id, createdAt: new Date(), ...data };
        paymentsDb.set(id, pay);
        return Promise.resolve(pay);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const pay = paymentsDb.get(where.id);
        if (!pay) return Promise.resolve(null);
        const updated = { ...pay, ...data };
        paymentsDb.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const list = Array.from(paymentsDb.values()).filter((p) => {
          const order = ordersDb.get(p.orderId);
          return order && order.userId === where.order?.userId;
        });
        return Promise.resolve(list);
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockRedisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    ordersDb.clear();
    paymentsDb.clear();

    // Seed mock order
    ordersDb.set('order-id-123', {
      id: 'order-id-123',
      userId: 'cust-1',
      totalAmount: 49.99,
      status: 'pending',
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

    // Tokens
    adminToken = await jwtService.signAsync({ sub: 'admin-1', username: 'adminuser', role: 'admin', sessionId: 'sess-1' });
    customerToken = await jwtService.signAsync({ sub: 'cust-1', username: 'custuser', role: 'customer', sessionId: 'sess-2' });
  });

  describe('Stripe payment checkout flow', () => {
    it('should create payment intent, verify it, and list it in history', async () => {
      // 1. Create Checkout
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/payments/create')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: 'order-id-123',
          provider: 'stripe',
        })
        .expect(201);

      expect(createRes.body.status).toBe('success');
      const transactionId = createRes.body.data.transactionId;

      // 2. Verify
      const verifyRes = await request(app.getHttpServer())
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: 'order-id-123',
          transactionId,
        })
        .expect(200);

      expect(verifyRes.body.status).toBe('success');
      expect(verifyRes.body.data.qrToken).toBeDefined();

      // 3. History
      const histRes = await request(app.getHttpServer())
        .get('/api/v1/payments/history')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(histRes.body.data.payments).toHaveLength(1);
    });

    it('should reject refunds from customer accounts', async () => {
      // Create a successful mock card capture
      const paymentId = 'pay-success-123';
      paymentsDb.set(paymentId, {
        id: paymentId,
        orderId: 'order-id-123',
        amount: 49.99,
        provider: 'stripe',
        status: 'success',
        transactionId: 'pi_mock_123',
      });

      await request(app.getHttpServer())
        .post('/api/v1/payments/refund')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          paymentId,
        })
        .expect(403);
    });
  });

  describe('Stripe Webhook captures', () => {
    it('should process succeeded payment intent webhook event', async () => {
      // Setup pending intent
      const mockIntentId = 'pi_webhook_test';
      paymentsDb.set('pay-pending', {
        id: 'pay-pending',
        orderId: 'order-id-123',
        amount: 49.99,
        provider: 'stripe',
        status: 'pending',
        transactionId: mockIntentId,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: mockIntentId,
              metadata: {
                orderId: 'order-id-123',
              },
            },
          },
        })
        .expect(200);

      expect(res.body.received).toBe(true);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let customerToken: string;

  const now = new Date();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    payment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', amount: 150, status: 'success', createdAt: now },
        { id: 'p2', amount: 80,  status: 'success', createdAt: now },
      ]),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'o1', userId: 'u1', status: 'paid', createdAt: now, totalAmount: 150,
          items: [{ barcode: 'BC001', name: 'Tea', price: 3, quantity: 5 }],
        },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'u1', role: 'customer', createdAt: now },
        { id: 'u2', role: 'customer', createdAt: now },
      ]),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const role = where.id === 'admin-1' ? 'admin' : 'customer';
        return Promise.resolve({ id: where.id, role });
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
    product:        { count: jest.fn().mockResolvedValue(0) },
    store:          { count: jest.fn().mockResolvedValue(0) },
    storeEmployee:  { count: jest.fn().mockResolvedValue(0) },
    auditLog_alias: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const mockRedisService = {
    get:  jest.fn().mockResolvedValue(null),
    set:  jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService).useValue(mockPrismaService)
      .overrideProvider(RedisService).useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    adminToken    = await jwtService.signAsync({ sub: 'admin-1',  username: 'admin',    role: 'admin',    sessionId: 's1' });
    customerToken = await jwtService.signAsync({ sub: 'cust-1',   username: 'customer', role: 'customer', sessionId: 's2' });
  });

  afterEach(() => app.close());

  // helper
  const adminGet = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${adminToken}`);

  // ── Auth guard ───────────────────────────────────

  it('should reject unauthenticated requests with 401', () =>
    request(app.getHttpServer()).get('/api/v1/analytics/revenue').expect(401));

  it('should reject customer-role requests with 403', () =>
    request(app.getHttpServer())
      .get('/api/v1/analytics/revenue')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403));

  // ── Revenue Summary ──────────────────────────────

  it('GET /api/v1/analytics/revenue → 200 with revenue fields', async () => {
    const res = await adminGet('/api/v1/analytics/revenue').expect(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('avgOrderValue');
    expect(res.body.data.total).toBe(230);
  });

  // ── Daily Sales ──────────────────────────────────

  it('GET /api/v1/analytics/daily → 200 with 30 data points', async () => {
    const res = await adminGet('/api/v1/analytics/daily').expect(200);
    expect(res.body.data.series.length).toBe(30);
  });

  // ── Weekly Sales ─────────────────────────────────

  it('GET /api/v1/analytics/weekly → 200', async () => {
    const res = await adminGet('/api/v1/analytics/weekly').expect(200);
    expect(res.body.status).toBe('success');
  });

  // ── Monthly Sales ────────────────────────────────

  it('GET /api/v1/analytics/monthly → 200 with 12 months', async () => {
    const res = await adminGet('/api/v1/analytics/monthly').expect(200);
    expect(res.body.data.series.length).toBe(12);
  });

  // ── Top Products ─────────────────────────────────

  it('GET /api/v1/analytics/top-products → 200 with top products list', async () => {
    const res = await adminGet('/api/v1/analytics/top-products').expect(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.topProducts)).toBe(true);
  });

  it('GET /api/v1/analytics/top-products?limit=3 → respects limit', async () => {
    const res = await adminGet('/api/v1/analytics/top-products?limit=3').expect(200);
    expect(res.body.data.topProducts.length).toBeLessThanOrEqual(3);
  });

  // ── Peak Hours ───────────────────────────────────

  it('GET /api/v1/analytics/peak-hours → 200 with 24 hour slots', async () => {
    const res = await adminGet('/api/v1/analytics/peak-hours').expect(200);
    expect(res.body.data.series.length).toBe(24);
    expect(res.body.data).toHaveProperty('peakHour');
  });

  // ── Customer Insights ────────────────────────────

  it('GET /api/v1/analytics/customers → 200 with customer fields', async () => {
    const res = await adminGet('/api/v1/analytics/customers').expect(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('returningCustomers');
    expect(res.body.data).toHaveProperty('signupSeries');
  });

  // ── Growth Charts ────────────────────────────────

  it('GET /api/v1/analytics/growth → 200 with 12 growth points', async () => {
    const res = await adminGet('/api/v1/analytics/growth').expect(200);
    expect(res.body.data.growth.length).toBe(12);
    expect(res.body.data).toHaveProperty('bestMonth');
  });
});

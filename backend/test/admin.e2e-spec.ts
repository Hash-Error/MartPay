import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/cache/redis.service';
import { JwtService } from '@nestjs/jwt';

describe('AdminController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let adminToken: string;
  let customerToken: string;

  const redisCacheDb = new Map<string, string>();

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    product: {
      count: jest.fn().mockResolvedValue(5),
    },
    store: {
      count: jest.fn().mockResolvedValue(2),
    },
    user: {
      count: jest.fn().mockResolvedValue(10),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const role = where.id === 'admin-1' ? 'admin' : 'customer';
        return Promise.resolve({ id: where.id, role });
      }),
    },
    storeEmployee: {
      count: jest.fn().mockResolvedValue(3),
    },
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
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
    redisCacheDb.clear();

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

    adminToken = await jwtService.signAsync({ sub: 'admin-1', username: 'adminuser', role: 'admin', sessionId: 'sess-1' });
    customerToken = await jwtService.signAsync({ sub: 'cust-1', username: 'custuser', role: 'customer', sessionId: 'sess-2' });
  });

  describe('Admin Dashboard web interface serving', () => {
    it('should serve HTML dashboard page', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/html');
    });
  });

  describe('Admin Rest Metrics API', () => {
    it('should allow admin to fetch stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.productsCount).toBe(5);
    });

    it('should reject stats fetching from customer accounts', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('should allow admin to modify parameters', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          globalTaxRate: 15.0,
          defaultCurrency: 'EUR',
        })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.settings.globalTaxRate).toBe(15.0);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
